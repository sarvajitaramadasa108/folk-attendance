import { ObjectId, type AnyBulkWriteOperation, type Collection, type Db, type Document } from "mongodb";
import * as xlsx from "xlsx";

export type WorkbookImportResult = {
  locationSlug: string;
  peopleImported: number;
  sessionsImported: number;
  attendanceMarksImported: number;
};

type PersonRow = {
  locationSlug: string;
  mobile: string;
  name: string;
  age: number | null;
  gender: string;
  college: string;
  branch: string;
  year: string;
  createdAt?: Date;
  updatedAt: Date;
};

type SessionRow = {
  locationSlug: string;
  sessionKey: string;
  sessionLabel: string;
  sessionDate: Date;
  createdAt?: Date;
  updatedAt: Date;
};

type AttendanceMarkRow = {
  locationSlug: string;
  sessionId: ObjectId;
  sessionKey: string;
  personId: ObjectId;
  mobile: string;
  status: "present";
  source: "import";
  markedAt: Date;
};

function normalizeMobile(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

function findHeaderIndex(headers: unknown[], terms: string[], fallback = -1) {
  const normalizedTerms = terms.map((term) => term.toLowerCase());
  for (let index = 0; index < headers.length; index += 1) {
    const header = normalizeHeader(headers[index]);
    if (!header) continue;
    if (normalizedTerms.some((term) => header.includes(term))) {
      return index;
    }
  }
  return fallback;
}

function toDateKey(value: unknown) {
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

function toSessionLabel(value: unknown) {
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

export async function importWorkbookToMongo({
  db,
  workbook,
  locationSlug,
  replaceExisting = true
}: {
  db: Db;
  workbook: xlsx.WorkBook;
  locationSlug: string;
  replaceExisting?: boolean;
}): Promise<WorkbookImportResult> {
  const masterSheet = workbook.Sheets.MASTER;
  const attendanceSheet = workbook.Sheets.ATTENDANCE;

  if (!masterSheet || !attendanceSheet) {
    throw new Error("Workbook must contain MASTER and ATTENDANCE sheets.");
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

  if (replaceExisting) {
    await Promise.all([
      db.collection("attendanceMarks").deleteMany({ locationSlug }),
      db.collection("sessions").deleteMany({ locationSlug }),
      db.collection("people").deleteMany({ locationSlug })
    ]);
  }

  const masterRows = xlsx.utils.sheet_to_json(masterSheet, {
    header: 1,
    defval: ""
  }) as unknown[][];

  const masterHeaders = masterRows[0] || [];
  const masterNameIndex = findHeaderIndex(masterHeaders, ["name"], 1);
  const masterMobileIndex = findHeaderIndex(masterHeaders, ["whatsapp number", "mobile number", "mobile", "phone"], 2);
  const masterCollegeIndex = findHeaderIndex(masterHeaders, ["college", "company"], 3);
  const masterCourseIndex = findHeaderIndex(masterHeaders, ["course of study", "course"], 4);
  const masterBranchIndex = findHeaderIndex(masterHeaders, ["branch"], 5);
  const masterYearIndex = findHeaderIndex(masterHeaders, ["year"], 6);

  const attendanceRows = xlsx.utils.sheet_to_json(attendanceSheet, {
    header: 1,
    defval: ""
  }) as unknown[][];

  const attendanceDateHeaders = attendanceRows[0] || [];
  const attendanceSessionHeaders = attendanceRows[1] || [];

  const peopleDocs: PersonRow[] = [];
  for (const row of masterRows.slice(1)) {
    const name = String(row[masterNameIndex] ?? "").trim();
    const mobile = normalizeMobile(row[masterMobileIndex]);
    if (!name || mobile.length !== 10) continue;

    const college = String(row[masterCollegeIndex] ?? "").trim();
    const course = String(row[masterCourseIndex] ?? "").trim();
    const branch = String(row[masterBranchIndex] ?? "").trim();
    const year = String(row[masterYearIndex] ?? "").trim();

    const personDoc: PersonRow = {
      locationSlug,
      mobile,
      name,
      age: null,
      gender: "Male",
      college: college || course,
      branch: branch || course,
      year,
      updatedAt: now
    };
    peopleDocs.push(personDoc);
  }

  const sessions: Array<{ col: number; label: string; sessionKey: string }> = [];
  for (let col = 4; col < Math.max(attendanceDateHeaders.length, attendanceSessionHeaders.length); col += 1) {
    const dateCell = attendanceDateHeaders[col];
    const labelCell = attendanceSessionHeaders[col];
    const label = toSessionLabel(labelCell || dateCell);
    if (!label) continue;
    const sessionKey = toDateKey(dateCell) || toDateKey(labelCell) || label;
    sessions.push({ col, label, sessionKey });
  }

  const sessionDocs: SessionRow[] = sessions.map((session) => ({
    locationSlug,
    sessionKey: session.sessionKey,
    sessionLabel: session.label,
    sessionDate: session.sessionKey.length === 10 ? new Date(`${session.sessionKey}T00:00:00+05:30`) : now,
    updatedAt: now
  }));

  if (replaceExisting) {
    if (peopleDocs.length > 0) {
      await db.collection("people").insertMany(
        peopleDocs.map((doc) => ({
          ...doc,
          createdAt: now
        })),
        { ordered: false }
      );
    }

    if (sessionDocs.length > 0) {
      await db.collection("sessions").insertMany(
        sessionDocs.map((doc) => ({
          ...doc,
          createdAt: now
        })),
        { ordered: false }
      );
    }
  } else {
    await bulkWriteInChunks(
      db.collection("people"),
      peopleDocs.map((doc) => ({
        updateOne: {
          filter: { locationSlug, mobile: doc.mobile },
          update: { $set: doc, $setOnInsert: { createdAt: now } },
          upsert: true
        }
      })),
      200
    );

    await bulkWriteInChunks(
      db.collection("sessions"),
      sessionDocs.map((doc) => ({
        updateOne: {
          filter: { locationSlug, sessionKey: doc.sessionKey },
          update: { $set: doc, $setOnInsert: { createdAt: now } },
          upsert: true
        }
      })),
      200
    );
  }

  const storedPeople = await db.collection("people").find({ locationSlug }).toArray();
  const storedSessions = await db.collection("sessions").find({ locationSlug }).toArray();

  const peopleIdByMobile = new Map<string, ObjectId>();
  const sessionIdByKey = new Map<string, ObjectId>();
  for (const person of storedPeople) {
    peopleIdByMobile.set(person.mobile, person._id as ObjectId);
  }
  for (const session of storedSessions) {
    sessionIdByKey.set(session.sessionKey, session._id as ObjectId);
  }

  const marks: AttendanceMarkRow[] = [];
  for (const session of sessions) {
    const sessionId = sessionIdByKey.get(session.sessionKey);
    if (!sessionId) continue;

    for (let rowIndex = 2; rowIndex < attendanceRows.length; rowIndex += 1) {
      const row = attendanceRows[rowIndex];
      if (!row) continue;

      const mobile = normalizeMobile(row[2]);
      const present = String(row[session.col] ?? "").trim().toLowerCase() === "yes";
      if (mobile.length !== 10 || !present) continue;

      const personId = peopleIdByMobile.get(mobile);
      if (!personId) continue;

      marks.push({
        locationSlug,
        sessionId,
        sessionKey: session.sessionKey,
        personId,
        mobile,
        status: "present",
        source: "import",
        markedAt: now
      });
    }
  }

  if (replaceExisting) {
    const markDocs = marks.map((mark) => ({
      ...mark
    }));
    await insertManyInChunks(db.collection("attendanceMarks"), markDocs, 500);
  } else {
    await bulkWriteInChunks(
      db.collection("attendanceMarks"),
      marks.map((mark) => ({
        updateOne: {
          filter: { locationSlug, sessionKey: mark.sessionKey, personId: mark.personId },
          update: {
            $setOnInsert: mark
          },
          upsert: true
        }
      })),
      500
    );
  }

  return {
    locationSlug,
    peopleImported: peopleDocs.length,
    sessionsImported: sessionDocs.length,
    attendanceMarksImported: marks.length
  };
}

export function readWorkbookFromBuffer(buffer: Buffer) {
  return xlsx.read(buffer, {
    type: "buffer",
    cellDates: true,
    cellNF: false,
    cellText: true
  });
}

async function bulkWriteInChunks(collection: Collection<Document>, ops: AnyBulkWriteOperation<Document>[], chunkSize: number) {
  for (let index = 0; index < ops.length; index += chunkSize) {
    const chunk = ops.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      await collection.bulkWrite(chunk, { ordered: false });
    }
  }
}

async function insertManyInChunks(
  collection: Collection<Document>,
  docs: Document[],
  chunkSize: number
) {
  for (let index = 0; index < docs.length; index += chunkSize) {
    const chunk = docs.slice(index, index + chunkSize);
    if (chunk.length > 0) {
      await collection.insertMany(chunk, { ordered: false });
    }
  }
}
