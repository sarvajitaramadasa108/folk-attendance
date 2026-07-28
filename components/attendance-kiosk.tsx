"use client";

import { useMemo, useState } from "react";

type LookupResponse =
  | { status: "invalid" }
  | {
      status: "new";
      mobile: string;
      session: { sessionKey: string; sessionLabel: string };
    }
  | {
      status: "found" | "already_marked";
      mobile: string;
      session: { sessionKey: string; sessionLabel: string };
      person: Person;
    };

type ResolvedLookup = Extract<LookupResponse, { status: "found" | "already_marked" }>;

type Person = {
  id: string;
  name: string;
  mobile: string;
  age: number | null;
  gender: string;
  college: string;
  branch: string;
  year: string;
};

type MarkResponse =
  | { status: "marked" | "already_marked"; person: Person; session: { sessionLabel: string } }
  | { status: "invalid_mobile" | "not_found" | "error" };

type Props = {
  locationSlug: string;
  locationName: string;
  accent: string;
  accentSoft: string;
  subtitle: string;
};

export function AttendanceKiosk({
  locationSlug,
  locationName,
  accent,
  accentSoft,
  subtitle
}: Props) {
  const [mobile, setMobile] = useState("");
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [mode, setMode] = useState<"idle" | "checking" | "marking" | "saving" | "done">("idle");
  const [message, setMessage] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "Male",
    college: "",
    branch: "",
    year: ""
  });

  const lookupState = useMemo(() => {
    if (!lookup) return "idle";
    return lookup.status;
  }, [lookup]);
  const matchedLookup =
    lookupState === "found" || lookupState === "already_marked" ? (lookup as ResolvedLookup) : null;

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setMode("checking");
    setMessage("");
    setLookup(null);

    const response = await fetch(`/api/locations/${locationSlug}/attendance/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile })
    });

    const data = (await response.json()) as LookupResponse;
    setLookup(data);
    setMode("idle");

    if (data.status === "invalid") {
      setMessage("Please enter a valid 10-digit mobile number.");
    }
  }

  async function markExisting(personId: string) {
    setMode("marking");
    const response = await fetch(`/api/locations/${locationSlug}/attendance/mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId })
    });

    const data = (await response.json()) as MarkResponse;
    if (data.status === "marked" || data.status === "already_marked") {
      setMessage(
        data.status === "marked"
          ? `Attendance marked for ${data.person.name} in ${data.session.sessionLabel}.`
          : `${data.person.name} was already marked for this session.`
      );
      setMode("done");
      setLookup(null);
      setMobile("");
      return;
    }

    setMessage("We could not mark attendance right now. Please try again.");
    setMode("idle");
  }

  async function createAndMark(event: React.FormEvent) {
    event.preventDefault();
    setMode("saving");

    const response = await fetch(`/api/locations/${locationSlug}/attendance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        name: form.name,
        age: form.age ? Number(form.age) : null,
        gender: form.gender,
        college: form.college,
        branch: form.branch,
        year: form.year
      })
    });

    const data = (await response.json()) as MarkResponse;
    if (data.status === "marked" || data.status === "already_marked") {
      setMessage(
        data.status === "marked"
          ? `${data.person.name} registered and marked for ${data.session.sessionLabel}.`
          : `${data.person.name} was already marked for this session.`
      );
      setMode("done");
      setLookup(null);
      setMobile("");
      setForm({
        name: "",
        age: "",
        gender: "Male",
        college: "",
        branch: "",
        year: ""
      });
      return;
    }

    setMessage("The new entry could not be saved.");
    setMode("idle");
  }

  return (
    <div className="panel">
      <div className="panelInner">
        <div className="eyebrow" style={{ color: accent }}>
          {subtitle}
        </div>
        <h2 className="sectionTitle" style={{ marginTop: 8 }}>
          Mark attendance for {locationName}
        </h2>
        <p className="sectionNote">
          Search by mobile number first. If the number is not found, register the
          person and mark attendance in one step.
        </p>

        <div
          className="notice"
          style={{ marginTop: 16, borderColor: accentSoft, background: accentSoft }}
        >
          <span className="noticeStrong">Today is the active session.</span> The backend
          creates the current location session automatically.
        </div>

        <form className="stack" onSubmit={handleLookup} style={{ marginTop: 18 }}>
          <div className="field">
            <label htmlFor="mobile">Mobile number</label>
            <input
              id="mobile"
              inputMode="numeric"
              placeholder="Enter 10-digit number"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
            />
          </div>
          <button className="button" type="submit" disabled={mode === "checking"}>
            {mode === "checking" ? "Searching..." : "Find number"}
          </button>
        </form>

        {message ? (
          <div className="notice" style={{ marginTop: 14 }}>
            {message}
          </div>
        ) : null}

        {lookupState === "found" || lookupState === "already_marked" ? (
          <div className="card" style={{ marginTop: 18, background: "rgba(255,255,255,0.03)" }}>
            <div className="panelInner">
              <div className="pill pillSuccess">
                {lookup?.status === "already_marked" ? "Already marked" : "Number found"}
              </div>
              <div className="divider" />
              <div className="stack">
                <div>
                  <div className="metaLabel">Name</div>
                  <div className="metaValue" style={{ fontSize: 22 }}>
                    {(lookup?.status === "found" || lookup?.status === "already_marked") && lookup.person.name}
                  </div>
                </div>
                <div className="twoCol">
                  <div className="metaCard">
                    <div className="metaLabel">Mobile</div>
                    <div className="metaValue" style={{ fontSize: 18 }}>
                      {matchedLookup?.mobile}
                    </div>
                  </div>
                  <div className="metaCard">
                    <div className="metaLabel">Session</div>
                    <div className="metaValue" style={{ fontSize: 18 }}>
                      {matchedLookup?.session.sessionLabel}
                    </div>
                  </div>
                </div>
                {lookup?.status === "found" ? (
                  <button
                    className="button"
                    type="button"
                    onClick={() => markExisting(lookup.person.id)}
                    disabled={mode === "marking"}
                  >
                    {mode === "marking" ? "Marking..." : "Mark attendance"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {lookupState === "new" ? (
          <form className="stack" onSubmit={createAndMark} style={{ marginTop: 18 }}>
            <div className="pill pillWarning">New number - register person</div>
            <div className="fieldGrid">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="age">Age</label>
                <input
                  id="age"
                  inputMode="numeric"
                  placeholder="Age"
                  value={form.age}
                  onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  value={form.gender}
                  onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="year">Year</label>
                <input
                  id="year"
                  placeholder="Year / batch"
                  value={form.year}
                  onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
                />
              </div>
            </div>
            <div className="fieldGrid">
              <div className="field">
                <label htmlFor="college">College</label>
                <input
                  id="college"
                  placeholder="College or organization"
                  value={form.college}
                  onChange={(event) => setForm((current) => ({ ...current, college: event.target.value }))}
                />
              </div>
              <div className="field">
                <label htmlFor="branch">Branch</label>
                <input
                  id="branch"
                  placeholder="Branch / area"
                  value={form.branch}
                  onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))}
                />
              </div>
            </div>
            <button className="button" type="submit" disabled={mode === "saving"}>
              {mode === "saving" ? "Saving..." : "Register and mark attendance"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
