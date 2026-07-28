import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { formatIndiaDateKey, formatIndiaShortLabel, normalizeMobile } from "@/lib/format";

type PersonInput = {
  name: string;
  age?: number | null;
  gender?: string;
  college?: string;
  branch?: string;
  year?: string;
};

type LocationDoc = {
  slug: string;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PersonDoc = PersonInput & {
  _id: ObjectId;
  locationSlug: string;
  mobile: string;
  createdAt: Date;
  updatedAt: Date;
};

type SessionDoc = {
  _id: ObjectId;
  locationSlug: string;
  sessionKey: string;
  sessionLabel: string;
  sessionDate: Date;
  createdAt: Date;
  updatedAt: Date;
};

type AttendanceMarkDoc = {
  _id: ObjectId;
  locationSlug: string;
  sessionId: ObjectId;
  sessionKey: string;
  personId: ObjectId;
  mobile: string;
  status: "present";
  source: "kiosk" | "import";
  markedAt: Date;
};

async function ensureIndexes() {
  const db = await getDb();
  await Promise.all([
    db.collection("locations").createIndex({ slug: 1 }, { unique: true }),
    db.collection("people").createIndex({ locationSlug: 1, mobile: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ locationSlug: 1, sessionKey: 1 }, { unique: true }),
    db.collection("attendanceMarks").createIndex({ locationSlug: 1, sessionKey: 1, personId: 1 }, { unique: true })
  ]);
}

async function ensureLocation(locationSlug: string) {
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  await db.collection<LocationDoc>("locations").updateOne(
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
}

export async function getOrCreateCurrentSession(locationSlug: string) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const sessionKey = formatIndiaDateKey();
  const sessionLabel = formatIndiaShortLabel();
  const now = new Date();

  const result = await db.collection<SessionDoc>("sessions").findOneAndUpdate(
    { locationSlug, sessionKey },
    {
      $setOnInsert: {
        locationSlug,
        sessionKey,
        sessionLabel,
        sessionDate: new Date(),
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true, returnDocument: "after" }
  );

  if (!result) {
    throw new Error("Unable to create session");
  }

  return result;
}

export async function lookupMobile(locationSlug: string, mobileInput: string) {
  await ensureLocation(locationSlug);
  const mobile = normalizeMobile(mobileInput);

  if (mobile.length !== 10) {
    return { status: "invalid" as const };
  }

  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const person = await db.collection<PersonDoc>("people").findOne({ locationSlug, mobile });

  if (!person) {
    return { status: "new" as const, mobile, session };
  }

  const mark = await db.collection<AttendanceMarkDoc>("attendanceMarks").findOne({
    locationSlug,
    sessionKey: session.sessionKey,
    personId: person._id
  });

  if (mark) {
    return {
      status: "already_marked" as const,
      mobile,
      session,
      person: sanitizePerson(person)
    };
  }

  return {
    status: "found" as const,
    mobile,
    session,
    person: sanitizePerson(person)
  };
}

export async function markExistingPerson(locationSlug: string, personId: string) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const person = await db.collection<PersonDoc>("people").findOne({
    _id: new ObjectId(personId),
    locationSlug
  });

  if (!person) {
    return { status: "not_found" as const };
  }

  const now = new Date();
  const result = await db.collection<AttendanceMarkDoc>("attendanceMarks").updateOne(
    { locationSlug, sessionKey: session.sessionKey, personId: person._id },
    {
      $setOnInsert: {
        locationSlug,
        sessionId: session._id,
        sessionKey: session.sessionKey,
        personId: person._id,
        mobile: person.mobile,
        status: "present",
        source: "kiosk",
        markedAt: now
      }
    },
    { upsert: true }
  );

  const duplicate = result.upsertedCount === 0 && result.modifiedCount === 0;

  return {
    status: duplicate ? ("already_marked" as const) : ("marked" as const),
    session,
    person: sanitizePerson(person)
  };
}

export async function createPersonAndMark(locationSlug: string, input: PersonInput & { mobile: string }) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const mobile = normalizeMobile(input.mobile);

  if (!mobile || mobile.length !== 10) {
    return { status: "invalid_mobile" as const };
  }

  const now = new Date();
  const personDoc = {
    locationSlug,
    mobile,
    name: input.name.trim(),
    age: input.age ?? null,
    gender: input.gender?.trim() || "Male",
    college: input.college?.trim() || "",
    branch: input.branch?.trim() || "",
    year: input.year?.trim() || "",
    createdAt: now,
    updatedAt: now
  };

  const upsertResult = await db.collection<PersonDoc>("people").updateOne(
    { locationSlug, mobile },
    { $setOnInsert: personDoc, $set: { updatedAt: now } },
    { upsert: true }
  );

  const person = await db.collection<PersonDoc>("people").findOne({ locationSlug, mobile });

  if (!person) {
    return { status: "error" as const };
  }

  await db.collection<AttendanceMarkDoc>("attendanceMarks").updateOne(
    { locationSlug, sessionKey: session.sessionKey, personId: person._id },
    {
      $setOnInsert: {
        locationSlug,
        sessionId: session._id,
        sessionKey: session.sessionKey,
        personId: person._id,
        mobile: person.mobile,
        status: "present",
        source: "kiosk",
        markedAt: now
      }
    },
    { upsert: true }
  );

  return {
    status: upsertResult.upsertedCount > 0 ? ("created" as const) : ("existing" as const),
    session,
    person: sanitizePerson(person)
  };
}

export async function getAdminSummary(locationSlug: string, sessionKey?: string) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const currentSession = await getOrCreateCurrentSession(locationSlug);
  const selectedSessionKey = sessionKey || currentSession.sessionKey;

  const [totalPeople, totalSessions, masterPeople, sessions, sessionCounts, selectedSessionMarks] = await Promise.all([
    db.collection("people").countDocuments({ locationSlug }),
    db.collection("sessions").countDocuments({ locationSlug }),
    db
      .collection<PersonDoc>("people")
      .find({ locationSlug })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray(),
    db
      .collection<SessionDoc>("sessions")
      .find({ locationSlug })
      .sort({ sessionDate: -1, createdAt: -1 })
      .limit(24)
      .toArray(),
    db
      .collection<AttendanceMarkDoc>("attendanceMarks")
      .aggregate([
        { $match: { locationSlug } },
        { $group: { _id: "$sessionKey", presentCount: { $sum: 1 } } }
      ])
      .toArray(),
    db
      .collection<AttendanceMarkDoc>("attendanceMarks")
      .aggregate([
        { $match: { locationSlug, sessionKey: selectedSessionKey } },
        {
          $lookup: {
            from: "people",
            localField: "personId",
            foreignField: "_id",
            as: "person"
          }
        },
        { $unwind: "$person" },
        { $sort: { "person.name": 1 } }
      ])
      .toArray()
  ]);

  const peopleWithCounts = await db
    .collection<PersonDoc>("people")
    .aggregate([
      { $match: { locationSlug } },
      {
        $lookup: {
          from: "attendanceMarks",
          let: { personId: "$_id", locationSlug: "$locationSlug" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$personId", "$$personId"] },
                    { $eq: ["$locationSlug", "$$locationSlug"] }
                  ]
                }
              }
            }
          ],
          as: "marks"
        }
      },
      {
        $addFields: {
          presentSessions: { $size: "$marks" }
        }
      },
      { $sort: { presentSessions: -1, name: 1 } },
      { $limit: 50 }
    ])
    .toArray();

  const boysRegularFolk = peopleWithCounts
    .filter((person) => (person.gender || "").toLowerCase() === "male")
    .map((person) => ({
      id: String(person._id),
      name: person.name,
      mobile: person.mobile,
      college: person.college || "",
      branch: person.branch || "",
      gender: person.gender || "",
      presentSessions: Number(person.presentSessions || 0),
      attendanceRate: totalSessions ? Number(((person.presentSessions || 0) / totalSessions) * 100) : 0
    }));

  return {
    locationSlug,
    currentSession,
    selectedSessionKey,
    totalPeople,
    totalSessions,
    sessions: sessions.map((session) => ({
      id: String(session._id),
      sessionKey: session.sessionKey,
      sessionLabel: session.sessionLabel,
      presentCount: sessionCounts.find((item) => item._id === session.sessionKey)?.presentCount || 0
    })),
    masterPeople: masterPeople.map(sanitizePerson),
    selectedSessionAttendance: selectedSessionMarks.map((mark) => ({
      id: String(mark._id),
      personId: String(mark.person._id),
      name: mark.person.name,
      mobile: mark.person.mobile,
      gender: mark.person.gender || "",
      college: mark.person.college || "",
      branch: mark.person.branch || "",
      markedAt: mark.markedAt
    })),
    regularFolk: boysRegularFolk
  };
}

function sanitizePerson(person: PersonDoc) {
  return {
    id: String(person._id),
    name: person.name,
    mobile: person.mobile,
    age: person.age ?? null,
    gender: person.gender || "",
    college: person.college || "",
    branch: person.branch || "",
    year: person.year || "",
    createdAt: person.createdAt,
    updatedAt: person.updatedAt
  };
}
