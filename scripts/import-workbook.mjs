import fs from "node:fs/promises";
import xlsx from "xlsx";
import { MongoClient, ObjectId } from "mongodb";

const workbookPath = process.argv[2];
const locationSlug = process.argv[3] || "mvp";

if (!workbookPath) {
  console.error("Usage: node scripts/import-workbook.mjs <path-to-xlsx> [locationSlug]");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "folk_attendance";

if (!uri) {
  console.error("MONGODB_URI is required");
  process.exit(1);
}

function normalizeMobile(value) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function toDateKey(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      const year = String(parsed.y).padStart(4, "0");
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const text = String(value ?? "").trim();
  if (!text) return "";
  const ddmmyy = text.match(/^(\d{2})-(\d{2})-(\d{2,4})$/);
  if (ddmmyy) {
    const year = ddmmyy[3].length === 2 ? `20${ddmmyy[3]}` : ddmmyy[3];
    return `${year}-${ddmmyy[2]}-${ddmmyy[1]}`;
  }
  return text;
}

function toSessionLabel(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = xlsx.SSF.parse_date_code(value);
    if (parsed) {
      return `${String(parsed.d).padStart(2, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.y).slice(-2)}`;
    }
  }

  return String(value ?? "").trim();
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

const buffer = await fs.readFile(workbookPath);
const workbook = xlsx.read(buffer, {
  type: "buffer",
  cellDates: true,
  cellNF: false,
  cellText: true
});

const masterSheet = workbook.Sheets.MASTER;
const attendanceSheet = workbook.Sheets.ATTENDANCE;

if (!masterSheet || !attendanceSheet) {
  console.error("Workbook must contain MASTER and ATTENDANCE sheets.");
  process.exit(1);
}

const now = new Date();

await db.collection("locations").updateOne(
  { slug: locationSlug },
  {
    $setOnInsert: {
      slug: locationSlug,
      name: locationSlug.toUpperCase(),
      active: true,
      createdAt: now
    },
    $set: { updatedAt: now }
  },
  { upsert: true }
);

await Promise.all([
  db.collection("attendanceMarks").deleteMany({ locationSlug }),
  db.collection("sessions").deleteMany({ locationSlug }),
  db.collection("people").deleteMany({ locationSlug })
]);

const masterRows = xlsx.utils.sheet_to_json(masterSheet, {
  header: 1,
  defval: ""
});

const attendanceRows = xlsx.utils.sheet_to_json(attendanceSheet, {
  header: 1,
  defval: ""
});

const peopleByMobile = new Map();
let peopleImported = 0;

for (const row of masterRows.slice(1)) {
  const name = String(row[1] ?? "").trim();
  const mobile = normalizeMobile(row[4]);
  if (!name || mobile.length !== 10) continue;

  const personDoc = {
    locationSlug,
    mobile,
    name,
    age: row[2] === "" ? null : Number(row[2]),
    gender: String(row[3] ?? "").trim() || "Male",
    college: String(row[5] ?? "").trim(),
    branch: String(row[6] ?? "").trim(),
    year: String(row[7] ?? "").trim(),
    createdAt: now,
    updatedAt: now
  };

  const result = await db.collection("people").updateOne(
    { locationSlug, mobile },
    { $set: personDoc, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );

  const person = await db.collection("people").findOne({ locationSlug, mobile });
  if (!person) continue;

  peopleByMobile.set(mobile, { _id: new ObjectId(String(person._id)), mobile, name });

  if (result.upsertedCount > 0 || result.modifiedCount > 0) {
    peopleImported += 1;
  }
}

const sessionHeaders = attendanceRows[1] || [];
const sessions = [];
for (let col = 4; col < sessionHeaders.length; col += 1) {
  const label = toSessionLabel(sessionHeaders[col]);
  if (!label) continue;
  const sessionKey = toDateKey(sessionHeaders[col]) || label;
  sessions.push({ col, label, sessionKey });
}

let sessionsImported = 0;
let attendanceMarksImported = 0;

for (const session of sessions) {
  const sessionDate =
    session.sessionKey.length === 10 ? new Date(`${session.sessionKey}T00:00:00+05:30`) : now;

  await db.collection("sessions").updateOne(
    { locationSlug, sessionKey: session.sessionKey },
    {
      $set: {
        locationSlug,
        sessionKey: session.sessionKey,
        sessionLabel: session.label,
        sessionDate,
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
  sessionsImported += 1;

  const sessionDoc = await db.collection("sessions").findOne({ locationSlug, sessionKey: session.sessionKey });
  if (!sessionDoc) continue;

  for (let rowIndex = 2; rowIndex < attendanceRows.length; rowIndex += 1) {
    const row = attendanceRows[rowIndex];
    if (!row) continue;

    const mobile = normalizeMobile(row[2]);
    const present = String(row[session.col] ?? "").trim().toLowerCase() === "yes";
    if (mobile.length !== 10 || !present) continue;

    const person = peopleByMobile.get(mobile) || (await db.collection("people").findOne({ locationSlug, mobile }));
    if (!person) continue;

    const mark = await db.collection("attendanceMarks").updateOne(
      { locationSlug, sessionKey: session.sessionKey, personId: person._id },
      {
        $setOnInsert: {
          locationSlug,
          sessionId: sessionDoc._id,
          sessionKey: session.sessionKey,
          personId: person._id,
          mobile,
          status: "present",
          source: "import",
          markedAt: now
        }
      },
      { upsert: true }
    );

    if (mark.upsertedCount > 0) {
      attendanceMarksImported += 1;
    }
  }
}

await client.close();
console.log(
  `Imported ${peopleImported} people, ${sessionsImported} sessions and ${attendanceMarksImported} marks for ${locationSlug}.`
);
