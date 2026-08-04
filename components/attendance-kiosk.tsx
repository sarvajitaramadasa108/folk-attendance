"use client";

import { useEffect, useState } from "react";

type Person = {
  id: string;
  name: string;
  mobile: string;
  age: number | null;
  gender: string;
  college: string;
  branch: string;
  year: string;
  profileComplete: boolean;
};

type LookupResponse =
  | { status: "invalid" }
  | { status: "none"; mobile: string; session: { sessionLabel: string } }
  | { status: "auto_mark"; mobile: string; session: { sessionLabel: string }; person: Person }
  | { status: "choose"; mobile: string; session: { sessionLabel: string }; people: Person[] }
  | {
      status: "fill";
      mobile: string;
      session: { sessionLabel: string };
      people: Person[];
      selectedPersonId: string;
      missingFields: string[];
    };

type SubmitResponse =
  | {
      status: "marked" | "already_marked";
      session: { sessionLabel: string };
      person: Person;
      message: string;
    }
  | { status: "invalid" | "not_found" | "error"; message: string };

type HistoryResponse =
  | { status: "invalid"; message: string }
  | { status: "choose"; mobile: string; people: Person[] }
  | {
      status: "ready";
      mobile: string;
      person: Person;
      summary: { attended: number; total: number; percentage: number };
      rows: Array<{ sno: number; sessionDate: string; attended: boolean }>;
    };

type Props = {
  locationSlug: string;
  locationName: string;
  accent: string;
};

type FormState = {
  name: string;
  age: string;
  gender: string;
  college: string;
  branch: string;
  year: string;
};

const emptyForm: FormState = {
  name: "",
  age: "",
  gender: "Male",
  college: "",
  branch: "",
  year: ""
};

function formFromPerson(person?: Person): FormState {
  return {
    name: person?.name || "",
    age: person?.age ? String(person.age) : "",
    gender: person?.gender || "Male",
    college: person?.college || "",
    branch: person?.branch || "",
    year: person?.year || ""
  };
}

function isBlank(value: string) {
  return !value || !value.trim();
}

function formatMissingFields(fields: string[]) {
  if (!fields.length) return "missing details";
  return fields.map((field) => field.replace(/^[a-z]/, (c) => c.toUpperCase())).join(", ");
}

export function AttendanceKiosk({ locationSlug, locationName, accent }: Props) {
  const [mobile, setMobile] = useState("");
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyMobile, setHistoryMobile] = useState("");
  const [historyLookup, setHistoryLookup] = useState<HistoryResponse | null>(null);
  const [historySelectedPersonId, setHistorySelectedPersonId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");

  useEffect(() => {
    if (!lookup) {
      return;
    }

    if (lookup.status === "choose") {
      const first = lookup.people[0];
      setSelectedPersonId(first?.id || "");
      setForm(formFromPerson(first));
      return;
    }

    if (lookup.status === "fill") {
      const selected = lookup.people.find((person) => person.id === lookup.selectedPersonId) || lookup.people[0];
      setSelectedPersonId(selected?.id || "");
      setForm(formFromPerson(selected));
      return;
    }

    if (lookup.status === "none") {
      setSelectedPersonId("");
      setForm(emptyForm);
    }
  }, [lookup]);

  function resetAfterSuccess(nextMessage: string) {
    setMessage(nextMessage);
    setMobile("");
    setLookup(null);
    setSelectedPersonId("");
    setForm(emptyForm);
  }

  async function handleLookup(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setLookup(null);
    setSelectedPersonId("");

    const response = await fetch(`/api/locations/${locationSlug}/attendance/lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile })
    });

    const data = (await response.json()) as LookupResponse;
    setLoading(false);

    if (data.status === "invalid") {
      setMessage("Please enter a valid mobile number.");
      return;
    }

    if (data.status === "auto_mark") {
      await markSelected(data.person.id);
      return;
    }

    setLookup(data);
  }

  async function markSelected(personId: string) {
    setLoading(true);
    const response = await fetch(`/api/locations/${locationSlug}/attendance/mark`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId })
    });

    const data = (await response.json()) as SubmitResponse;
    setLoading(false);

    if (data.status === "marked" || data.status === "already_marked") {
      resetAfterSuccess(data.message);
      return;
    }

    setMessage(data.message || "Unable to mark attendance right now.");
  }

  async function handleSubmitDetails(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    const response = await fetch(`/api/locations/${locationSlug}/attendance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mobile,
        personId: selectedPersonId || undefined,
        name: form.name,
        age: isBlank(form.age) ? null : Number(form.age),
        gender: form.gender,
        college: form.college,
        branch: form.branch,
        year: form.year
      })
    });

    const data = (await response.json()) as SubmitResponse;
    setLoading(false);

    if (data.status === "marked" || data.status === "already_marked") {
      resetAfterSuccess(data.message);
      return;
    }

    setMessage(data.message || "Could not save attendance.");
  }

  async function handleHistorySearch(event: React.FormEvent) {
    event.preventDefault();
    setHistoryLoading(true);
    setHistoryMessage("");
    setHistoryLookup(null);

    const response = await fetch(`/api/locations/${locationSlug}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: historyMobile, personId: historySelectedPersonId || undefined })
    });

    const data = (await response.json()) as HistoryResponse;
    setHistoryLoading(false);

    if (data.status === "invalid") {
      setHistoryMessage(data.message);
      return;
    }

    if (data.status === "choose") {
      setHistoryLookup(data);
      setHistorySelectedPersonId(data.people[0]?.id || "");
      return;
    }

    setHistoryLookup(data);
    setHistorySelectedPersonId(data.person.id);
  }

  async function handleHistorySelect(event: React.FormEvent) {
    event.preventDefault();
    if (!historySelectedPersonId) {
      setHistoryMessage("Please choose a name first.");
      return;
    }

    setHistoryLoading(true);
    const response = await fetch(`/api/locations/${locationSlug}/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile: historyMobile, personId: historySelectedPersonId })
    });
    const data = (await response.json()) as HistoryResponse;
    setHistoryLoading(false);

    if (data.status === "invalid") {
      setHistoryMessage(data.message);
      return;
    }

    setHistoryLookup(data);
  }

  return (
    <>
      <div className="publicShell">
        <div className="container">
          <header className="publicHeader">
            <div className="brandMark">
              <span className="brandDot" />
              {locationName}
            </div>
            <button className="buttonGhost" type="button" onClick={() => setHistoryOpen(true)}>
              My History
            </button>
          </header>

          <main className="publicMain">
            <section className="publicCard">
              <div className="eyebrow" style={{ color: accent }}>
                Mark your attendance
              </div>
              <h1 className="publicTitle">Mark your attendance</h1>
              <p className="publicLead">
                Enter your mobile number and continue. The system will handle matching, duplicate names,
                missing profile fields, and new registrations automatically.
              </p>

              {message ? <div className="notice publicNotice">{message}</div> : null}

              {lookup?.status === "choose" ? (
                <form
                  className="publicStack"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void markSelected(selectedPersonId);
                  }}
                >
                  <div className="pill pillWarning">Multiple registrations found for this number</div>
                  <div className="stack">
                    {lookup.people.map((person) => (
                      <label className="choiceRow" key={person.id}>
                        <input
                          type="radio"
                          name="selectedPerson"
                          checked={selectedPersonId === person.id}
                          onChange={() => {
                            setSelectedPersonId(person.id);
                            setForm(formFromPerson(person));
                          }}
                        />
                        <span>
                          <strong>{person.name}</strong>
                          <span className="choiceMeta">
                            {person.college || "No college"} {person.branch ? `- ${person.branch}` : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button className="button" type="submit" disabled={loading}>
                    {loading ? "Marking..." : "Submit"}
                  </button>
                </form>
              ) : null}

              {lookup?.status === "fill" || lookup?.status === "none" ? (
                <form className="publicStack" onSubmit={(event) => void handleSubmitDetails(event)}>
                  {lookup.status === "fill" ? (
                    <>
                      <div className="pill pillWarning">
                        Missing details: {formatMissingFields(lookup.missingFields)}
                      </div>
                      <div className="stack">
                        {lookup.people.map((person) => (
                          <label className="choiceRow" key={person.id}>
                            <input
                              type="radio"
                              name="selectedPerson"
                              checked={selectedPersonId === person.id}
                              onChange={() => {
                                setSelectedPersonId(person.id);
                                setForm(formFromPerson(person));
                              }}
                            />
                            <span>
                              <strong>{person.name}</strong>
                              <span className="choiceMeta">{person.profileComplete ? "Complete profile" : "Needs details"}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="pill pillWarning">New candidate registration</div>
                  )}

                  <div className="fieldGrid">
                    <div className="field">
                      <label htmlFor="name">Name</label>
                      <input
                        id="name"
                        value={form.name}
                        placeholder="Full name"
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="age">Age</label>
                      <input
                        id="age"
                        inputMode="numeric"
                        value={form.age}
                        placeholder="Age"
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
                        value={form.year}
                        placeholder="Year / batch"
                        onChange={(event) => setForm((current) => ({ ...current, year: event.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="fieldGrid">
                    <div className="field">
                      <label htmlFor="college">College</label>
                      <input
                        id="college"
                        value={form.college}
                        placeholder="College or organization"
                        onChange={(event) => setForm((current) => ({ ...current, college: event.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="branch">Branch</label>
                      <input
                        id="branch"
                        value={form.branch}
                        placeholder="Branch / area"
                        onChange={(event) => setForm((current) => ({ ...current, branch: event.target.value }))}
                      />
                    </div>
                  </div>

                  <button className="button" type="submit" disabled={loading}>
                    {loading ? "Submitting..." : "Submit"}
                  </button>
                </form>
              ) : null}

              {!lookup ? (
                <form className="publicStack" onSubmit={(event) => void handleLookup(event)}>
                  <div className="field">
                    <label htmlFor="mobile">Mobile number</label>
                    <input
                      id="mobile"
                      inputMode="numeric"
                      placeholder="Enter mobile number"
                      value={mobile}
                      onChange={(event) => setMobile(event.target.value)}
                    />
                  </div>
                  <button className="button" type="submit" disabled={loading}>
                    {loading ? "Searching..." : "Submit"}
                  </button>
                </form>
              ) : null}

              {lookup?.status === "choose" ? (
                <div className="notice" style={{ marginTop: 16 }}>
                  Select your name and click submit.
                </div>
              ) : null}

              {lookup?.status === "auto_mark" ? null : null}
            </section>
          </main>
        </div>
      </div>

      {historyOpen ? (
        <div className="historyOverlay" role="dialog" aria-modal="true">
          <div className="historyPanel">
            <div className="publicHeader" style={{ paddingTop: 0 }}>
              <div className="brandMark">
                <span className="brandDot" />
                My History
              </div>
              <button className="buttonGhost" type="button" onClick={() => setHistoryOpen(false)}>
                Close
              </button>
            </div>

            <h2 className="publicTitle" style={{ marginTop: 8, fontSize: 32 }}>
              Attendance history
            </h2>
            <p className="publicLead">
              Enter the same mobile number to see your session history.
            </p>

            {historyMessage ? <div className="notice publicNotice">{historyMessage}</div> : null}

            {!historyLookup ? (
              <form className="publicStack" onSubmit={(event) => void handleHistorySearch(event)}>
                <div className="field">
                  <label htmlFor="history-mobile">Mobile number</label>
                  <input
                    id="history-mobile"
                    inputMode="numeric"
                    value={historyMobile}
                    placeholder="Enter mobile number"
                    onChange={(event) => setHistoryMobile(event.target.value)}
                  />
                </div>
                <button className="button" type="submit" disabled={historyLoading}>
                  {historyLoading ? "Searching..." : "Submit"}
                </button>
              </form>
            ) : null}

            {historyLookup?.status === "choose" ? (
              <form className="publicStack" onSubmit={(event) => void handleHistorySelect(event)}>
                <div className="pill pillWarning">Multiple registrations found</div>
                <div className="stack">
                  {historyLookup.people.map((person) => (
                    <label className="choiceRow" key={person.id}>
                      <input
                        type="radio"
                        name="historyPerson"
                        checked={historySelectedPersonId === person.id}
                        onChange={() => setHistorySelectedPersonId(person.id)}
                      />
                      <span>
                        <strong>{person.name}</strong>
                        <span className="choiceMeta">{person.college || "No college"} {person.branch ? `- ${person.branch}` : ""}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button className="button" type="submit" disabled={historyLoading}>
                  {historyLoading ? "Loading..." : "View history"}
                </button>
              </form>
            ) : null}

            {historyLookup?.status === "ready" ? (
              <div className="publicStack">
                <div className="gridCards" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <div className="statCard">
                    <div className="statLabel">Sessions attended</div>
                    <div className="statValue">{historyLookup.summary.attended}</div>
                  </div>
                  <div className="statCard">
                    <div className="statLabel">Total sessions</div>
                    <div className="statValue">{historyLookup.summary.total}</div>
                  </div>
                  <div className="statCard">
                    <div className="statLabel">Attendance percentage</div>
                    <div className="statValue">{historyLookup.summary.percentage}%</div>
                  </div>
                </div>

                <div className="tableWrap" style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>S No</th>
                        <th>Session Date</th>
                        <th>Attended</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyLookup.rows.map((row) => (
                        <tr key={row.sno}>
                          <td>{row.sno}</td>
                          <td>{row.sessionDate}</td>
                          <td>{row.attended ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
