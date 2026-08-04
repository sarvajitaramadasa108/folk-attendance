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
  sessionName?: string;
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

export type SessionInfo = {
  sessionKey: string;
  sessionLabel: string;
  sessionName: string;
  displayLabel: string;
  sessionDate: string;
};

export type PublicPerson = {
  id: string;
  name: string;
  mobile: string;
  age: number | null;
  gender: string;
  college: string;
  branch: string;
  year: string;
  profileComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceLookupResult =
  | { status: "invalid" }
  | { status: "none"; mobile: string; session: SessionInfo }
  | { status: "auto_mark"; mobile: string; session: SessionInfo; person: PublicPerson }
  | { status: "choose"; mobile: string; session: SessionInfo; people: PublicPerson[] }
  | { status: "fill"; mobile: string; session: SessionInfo; people: PublicPerson[]; selectedPersonId: string; missingFields: string[] };

export type AttendanceSubmitResult =
  | { status: "marked" | "already_marked"; session: SessionInfo; person: PublicPerson; message: string }
  | { status: "invalid" | "not_found" | "error"; message: string };

export type AttendanceHistoryResult =
  | { status: "invalid"; message: string }
  | { status: "choose"; mobile: string; people: PublicPerson[] }
  | {
      status: "ready";
      mobile: string;
      person: PublicPerson;
      summary: { attended: number; total: number; percentage: number };
      rows: Array<{ sno: number; sessionDate: string; attended: boolean }>;
    };

export type SessionSummary = {
  id: string;
  sessionKey: string;
  sessionLabel: string;
  sessionName: string;
  displayLabel: string;
  sessionDate: string;
  presentCount: number;
  newAttendeesCount: number;
};

function formatSessionDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function toSessionInfo(session: SessionDoc): SessionInfo {
  const sessionName = String(session.sessionName || "").trim();
  const displayLabel = sessionName || session.sessionLabel || formatSessionDateLabel(session.sessionDate);
  return {
    sessionKey: session.sessionKey,
    sessionLabel: session.sessionLabel,
    sessionName,
    displayLabel,
    sessionDate: session.sessionDate.toISOString()
  };
}

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

function isProfileComplete(person: Pick<PersonDoc, "age" | "gender" | "college" | "branch" | "year">) {
  const age = typeof person.age === "number" && Number.isFinite(person.age) && person.age > 0;
  const gender = Boolean(String(person.gender || "").trim());
  const college = Boolean(String(person.college || "").trim());
  const branch = Boolean(String(person.branch || "").trim());
  const year = Boolean(String(person.year || "").trim());
  return age && gender && college && branch && year;
}

function missingProfileFields(person: Pick<PersonDoc, "age" | "gender" | "college" | "branch" | "year">) {
  const missing: string[] = [];
  if (!(typeof person.age === "number" && Number.isFinite(person.age) && person.age > 0)) missing.push("age");
  if (!String(person.gender || "").trim()) missing.push("gender");
  if (!String(person.college || "").trim()) missing.push("college");
  if (!String(person.branch || "").trim()) missing.push("branch");
  if (!String(person.year || "").trim()) missing.push("year");
  return missing;
}

function sanitizePerson(person: PersonDoc): PublicPerson {
  return {
    id: String(person._id),
    name: person.name,
    mobile: person.mobile,
    age: person.age ?? null,
    gender: person.gender || "",
    college: person.college || "",
    branch: person.branch || "",
    year: person.year || "",
    profileComplete: isProfileComplete(person),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt
  };
}

function getDisplayLabelFromSession(session: Pick<SessionDoc, "sessionName" | "sessionLabel" | "sessionDate">) {
  return String(session.sessionName || "").trim() || session.sessionLabel || formatSessionDateLabel(session.sessionDate);
}

export async function getOrCreateCurrentSession(locationSlug: string) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const sessionKey = formatIndiaDateKey();
  const sessionLabel = formatIndiaShortLabel();
  const now = new Date();

  await db.collection<SessionDoc>("sessions").updateOne(
    { locationSlug, sessionKey },
    {
      $setOnInsert: {
        locationSlug,
        sessionKey,
        sessionLabel,
        sessionName: "",
        sessionDate: new Date(),
        createdAt: now
      },
      $set: { updatedAt: now }
    },
    { upsert: true }
  );

  const session = await db.collection<SessionDoc>("sessions").findOne({ locationSlug, sessionKey });

  if (!session) {
    throw new Error("Unable to create session");
  }

  return session;
}

export async function lookupMobile(locationSlug: string, mobileInput: string): Promise<AttendanceLookupResult> {
  await ensureLocation(locationSlug);
  const mobile = normalizeMobile(mobileInput);

  if (mobile.length !== 10) {
    return { status: "invalid" as const };
  }

  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const people = await db.collection<PersonDoc>("people").find({ locationSlug, mobile }).sort({ createdAt: 1 }).toArray();

  if (people.length === 0) {
    return { status: "none", mobile, session: toSessionInfo(session) };
  }

  const persons = people.map(sanitizePerson);
  const completePeople = people.filter((person) => isProfileComplete(person));
  const anyIncomplete = people.some((person) => !isProfileComplete(person));

  if (people.length === 1 && completePeople.length === 1) {
    return {
      status: "auto_mark",
      mobile,
      session: toSessionInfo(session),
      person: sanitizePerson(people[0])
    };
  }

  if (people.length > 1 && !anyIncomplete) {
    return {
      status: "choose",
      mobile,
      session: toSessionInfo(session),
      people: persons
    };
  }

  const selected = people.find((person) => !isProfileComplete(person)) || people[0];
  return {
    status: "fill",
    mobile,
    session: toSessionInfo(session),
    people: persons,
    selectedPersonId: String(selected._id),
    missingFields: missingProfileFields(selected)
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
    session: toSessionInfo(session),
    person: sanitizePerson(person)
  };
}

export async function createPersonAndMark(
  locationSlug: string,
  input: PersonInput & { mobile: string; personId?: string }
): Promise<AttendanceSubmitResult> {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const mobile = normalizeMobile(input.mobile);

  if (!mobile || mobile.length !== 10) {
    return { status: "invalid", message: "Invalid mobile number." };
  }

  const now = new Date();
  const updateFields = {
    locationSlug,
    mobile,
    name: input.name.trim(),
    age: input.age ?? null,
    gender: input.gender?.trim() || "Male",
    college: input.college?.trim() || "",
    branch: input.branch?.trim() || "",
    year: input.year?.trim() || "",
    updatedAt: now
  };

  let person: PersonDoc | null = null;

  if (input.personId) {
    person = await db.collection<PersonDoc>("people").findOne({
      _id: new ObjectId(input.personId),
      locationSlug,
      mobile
    });

    if (!person) {
      return { status: "not_found", message: "Selected registration not found." };
    }

    const merged = {
      ...person,
      ...updateFields,
      name: input.name.trim() || person.name,
      age: input.age ?? person.age ?? null,
      gender: input.gender?.trim() || person.gender || "Male",
      college: input.college?.trim() || person.college || "",
      branch: input.branch?.trim() || person.branch || "",
      year: input.year?.trim() || person.year || ""
    };

    await db.collection<PersonDoc>("people").updateOne(
      { _id: person._id, locationSlug, mobile },
      {
        $set: {
          name: merged.name,
          age: merged.age,
          gender: merged.gender,
          college: merged.college,
          branch: merged.branch,
          year: merged.year,
          updatedAt: now
        }
      }
    );

    person = await db.collection<PersonDoc>("people").findOne({ _id: person._id, locationSlug, mobile });
  } else {
    await db.collection<PersonDoc>("people").updateOne(
      { locationSlug, mobile },
      {
        $set: updateFields,
        $setOnInsert: {
          name: input.name.trim(),
          age: input.age ?? null,
          gender: input.gender?.trim() || "Male",
          college: input.college?.trim() || "",
          branch: input.branch?.trim() || "",
          year: input.year?.trim() || "",
          createdAt: now
        }
      },
      { upsert: true }
    );

    person = await db.collection<PersonDoc>("people").findOne({ locationSlug, mobile });
  }

  if (!person) {
    return { status: "error", message: "Unable to save person." };
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
    status: "marked",
    session: toSessionInfo(session),
    person: sanitizePerson(person),
    message: `Welcome ${person.name}. Attendance marked Successfully`
  };
}

export async function markAttendanceForPerson(locationSlug: string, personId: string): Promise<AttendanceSubmitResult> {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const session = await getOrCreateCurrentSession(locationSlug);
  const person = await db.collection<PersonDoc>("people").findOne({
    _id: new ObjectId(personId),
    locationSlug
  });

  if (!person) {
    return { status: "not_found", message: "Person not found." };
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
    status: duplicate ? "already_marked" : "marked",
    session: toSessionInfo(session),
    person: sanitizePerson(person),
    message: duplicate
      ? `${person.name} was already marked for this session.`
      : `Welcome ${person.name}. Attendance marked Successfully`
  };
}

export async function getAttendanceHistory(locationSlug: string, mobileInput: string, personId?: string): Promise<AttendanceHistoryResult> {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const mobile = normalizeMobile(mobileInput);
  if (mobile.length !== 10) {
    return { status: "invalid", message: "Please enter a valid mobile number." };
  }

  const people = await db.collection<PersonDoc>("people").find({ locationSlug, mobile }).sort({ createdAt: 1 }).toArray();
  if (people.length === 0) {
    return { status: "invalid", message: "No registrations found for this mobile number." };
  }

  if (!personId && people.length > 1) {
    return { status: "choose", mobile, people: people.map(sanitizePerson) };
  }

  const selected = personId
    ? people.find((person) => String(person._id) === personId) || null
    : people[0];

  if (!selected) {
    return { status: "invalid", message: "Selected registration was not found." };
  }

  const sessions = await db
    .collection<SessionDoc>("sessions")
    .find({ locationSlug })
    .sort({ sessionDate: 1, createdAt: 1 })
    .toArray();

  const marks = await db
    .collection<AttendanceMarkDoc>("attendanceMarks")
    .find({ locationSlug, personId: selected._id })
    .toArray();

  const marksBySession = new Set(marks.map((mark) => mark.sessionKey));
  const rows = sessions.map((session, index) => ({
    sno: index + 1,
    sessionDate: formatSessionDateLabel(session.sessionDate),
    attended: marksBySession.has(session.sessionKey)
  }));
  const attended = rows.filter((row) => row.attended).length;
  const total = rows.length;

  return {
    status: "ready",
    mobile,
    person: sanitizePerson(selected),
    summary: {
      attended,
      total,
      percentage: total ? Number(((attended / total) * 100).toFixed(1)) : 0
    },
    rows
  };
}

export async function updateSessionNames(
  locationSlug: string,
  updates: Array<{ sessionKey: string; sessionName: string }>
) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const now = new Date();
  let updated = 0;

  for (const update of updates) {
    const sessionKey = String(update.sessionKey || "").trim();
    if (!sessionKey) continue;

    const sessionName = String(update.sessionName || "").trim();
    const result = await db.collection<SessionDoc>("sessions").updateOne(
      { locationSlug, sessionKey },
      {
        $set: {
          sessionName,
          updatedAt: now
        }
      }
    );

    if (result.matchedCount > 0) {
      updated += 1;
    }
  }

  return { updated };
}

export async function getAdminSummary(locationSlug: string, sessionKey?: string) {
  await ensureLocation(locationSlug);
  const db = await getDb();
  const currentSession = await getOrCreateCurrentSession(locationSlug);
  const [masterPeople, sessions, sessionCounts, selectedSessionMarks, firstAttendanceCounts, peopleWithCounts, totalPeople, totalSessions] = await Promise.all([
    db
      .collection<PersonDoc>("people")
      .find({ locationSlug })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray(),
    db
      .collection<SessionDoc>("sessions")
      .find({ locationSlug })
      .sort({ sessionDate: 1, createdAt: 1 })
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
        { $match: { locationSlug, sessionKey: sessionKey || currentSession.sessionKey } },
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
      .toArray(),
    db
      .collection<AttendanceMarkDoc>("attendanceMarks")
      .aggregate([
        { $match: { locationSlug } },
        { $sort: { sessionKey: 1, markedAt: 1 } },
        { $group: { _id: "$personId", firstSessionKey: { $first: "$sessionKey" } } },
        { $group: { _id: "$firstSessionKey", newAttendeesCount: { $sum: 1 } } }
      ])
      .toArray(),
    db
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
        { $limit: 1000 }
      ])
      .toArray(),
    db.collection("people").countDocuments({ locationSlug }),
    db.collection("sessions").countDocuments({ locationSlug }),
  ]);

  const selectedSessionKey = sessionKey || currentSession.sessionKey;
  const sessionCountsMap = new Map(sessionCounts.map((item) => [String(item._id), Number(item.presentCount || 0)]));
  const newAttendeesMap = new Map(firstAttendanceCounts.map((item) => [String(item._id), Number(item.newAttendeesCount || 0)]));
  const sessionsSorted = sessions.slice();
  const latestSession = sessionsSorted[sessionsSorted.length - 1] || currentSession;
  const latestSessionKey = latestSession.sessionKey;
  const latestSessionDisplayLabel = getDisplayLabelFromSession(latestSession);
  const latestSessionNewCount = Number(newAttendeesMap.get(latestSessionKey) || 0);

  const regularFolk = peopleWithCounts
    .map((person) => ({
      id: String(person._id),
      name: person.name,
      mobile: person.mobile,
      college: person.college || "",
      branch: person.branch || "",
      gender: person.gender || "",
      presentSessions: Number(person.presentSessions || 0),
      attendanceRate: totalSessions ? Number(((person.presentSessions || 0) / totalSessions) * 100) : 0
    }))
    .filter((person) => person.presentSessions >= 5);

  return {
    locationSlug,
    currentSession: {
      sessionKey: currentSession.sessionKey,
      sessionLabel: currentSession.sessionLabel,
      sessionName: currentSession.sessionName || "",
      displayLabel: getDisplayLabelFromSession(currentSession),
      sessionDate: currentSession.sessionDate.toISOString()
    },
    selectedSessionKey,
    totalPeople,
    totalSessions,
    latestSessionKey,
    latestSessionDisplayLabel,
    latestSessionNewCount,
    sessions: sessionsSorted.map((session) => ({
      id: String(session._id),
      sessionKey: session.sessionKey,
      sessionLabel: session.sessionLabel,
      sessionName: session.sessionName || "",
      displayLabel: getDisplayLabelFromSession(session),
      sessionDate: session.sessionDate.toISOString(),
      presentCount: sessionCountsMap.get(session.sessionKey) || 0,
      newAttendeesCount: newAttendeesMap.get(session.sessionKey) || 0
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
    regularFolk
  };
}
