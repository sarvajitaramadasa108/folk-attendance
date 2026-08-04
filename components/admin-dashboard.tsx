"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toPercent } from "@/lib/format";

type Summary = {
  locationSlug: string;
  currentSession: {
    sessionKey: string;
    sessionLabel: string;
    sessionName: string;
    displayLabel: string;
    sessionDate: string;
  };
  selectedSessionKey: string;
  totalPeople: number;
  totalSessions: number;
  latestSessionKey: string;
  latestSessionDisplayLabel: string;
  latestSessionNewCount: number;
  sessions: Array<{
    id: string;
    sessionKey: string;
    sessionLabel: string;
    sessionName: string;
    displayLabel: string;
    sessionDate: string;
    presentCount: number;
    newAttendeesCount: number;
  }>;
  masterPeople: Array<{
    id: string;
    name: string;
    mobile: string;
    age: number | null;
    gender: string;
    college: string;
    branch: string;
    year: string;
    profileComplete: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  selectedSessionAttendance: Array<{
    id: string;
    personId: string;
    name: string;
    mobile: string;
    gender: string;
    college: string;
    branch: string;
    markedAt: string;
  }>;
  regularFolk: Array<{
    id: string;
    name: string;
    mobile: string;
    college: string;
    branch: string;
    gender: string;
    presentSessions: number;
    attendanceRate: number;
  }>;
};

type Props = {
  locationSlug: string;
  locationName: string;
  accent: string;
  subtitle: string;
};

type ViewKey = "master" | "sessions" | "attendance" | "regular";

const viewMeta: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "master", label: "Show master data", hint: "All people records with export" },
  { key: "sessions", label: "Sessions master", hint: "Name each session and save" },
  { key: "attendance", label: "Session-wise attendance", hint: "Pick a session and export" },
  { key: "regular", label: "Regularly attending folk", hint: "Minimum 5 sessions, ranked" }
];

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function toDateInputValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function downloadXlsx(fileName: string, sheetName: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function AdminDashboard({ locationSlug, locationName, accent, subtitle }: Props) {
  const [accessCode, setAccessCode] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<ViewKey>("master");
  const [sessionKey, setSessionKey] = useState("");
  const [masterSearch, setMasterSearch] = useState("");
  const [sessionSearch, setSessionSearch] = useState("");
  const [attendanceSearch, setAttendanceSearch] = useState("");
  const [regularSearch, setRegularSearch] = useState("");
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, string>>({});
  const [sessionDateDrafts, setSessionDateDrafts] = useState<Record<string, string>>({});
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionName, setNewSessionName] = useState("");
  const [saveState, setSaveState] = useState("");
  const [savingSessions, setSavingSessions] = useState(false);
  const [sessionActionBusy, setSessionActionBusy] = useState("");
  const [unlocked, setUnlocked] = useState(false);

  async function loadSummary(
    code = accessCode,
    selectedSessionKey = sessionKey,
    options?: { keepView?: boolean }
  ) {
    setLoading(true);
    setError("");
    setSaveState("");

    const params = new URLSearchParams();
    if (selectedSessionKey) {
      params.set("sessionKey", selectedSessionKey);
    }

    const response = await fetch(`/api/locations/${locationSlug}/admin/summary?${params.toString()}`, {
      headers: {
        "x-admin-key": code
      }
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      let message = raw || `Unable to load admin data (${response.status}).`;
      try {
        const parsed = JSON.parse(raw) as { error?: string };
        message = parsed.error || message;
      } catch {
        // no-op
      }
      setError(message);
      setLoading(false);
      return false;
    }

    const data = (await response.json()) as Summary;
    setSummary(data);
    setSessionKey(data.selectedSessionKey || data.latestSessionKey || data.currentSession.sessionKey);
    setSessionDrafts(
      Object.fromEntries(data.sessions.map((session) => [session.sessionKey, session.sessionName || ""]))
    );
    setSessionDateDrafts(
      Object.fromEntries(data.sessions.map((session) => [session.sessionKey, toDateInputValue(session.sessionDate)]))
    );
    setUnlocked(true);
    if (!options?.keepView) {
      setView("master");
    }
    setLoading(false);
    return true;
  }

  async function handleUnlock(event: React.FormEvent) {
    event.preventDefault();
    await loadSummary(accessCode, sessionKey);
  }

  async function handleSaveSessions() {
    if (!summary) return;

    setSavingSessions(true);
    setSaveState("");

    const response = await fetch(`/api/locations/${locationSlug}/admin/sessions`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": accessCode
      },
      body: JSON.stringify({
        sessions: summary.sessions.map((session) => ({
          sessionKey: session.sessionKey,
          sessionName: sessionDrafts[session.sessionKey] ?? "",
          sessionDate: sessionDateDrafts[session.sessionKey] ?? ""
        }))
      })
    });

    const body = (await response.json().catch(() => null)) as { error?: string; updated?: number } | null;
    if (!response.ok) {
      setSaveState(body?.error || "Unable to save session names.");
      setSavingSessions(false);
      return;
    }

    setSaveState(`Saved ${body?.updated ?? summary.sessions.length} session names.`);
    setSavingSessions(false);
    await loadSummary(accessCode, sessionKey, { keepView: true });
  }

  async function handleCreateSession() {
    if (!newSessionDate) {
      setSaveState("Please choose a session date first.");
      return;
    }

    setSessionActionBusy("create");
    setSaveState("");

    const response = await fetch(`/api/locations/${locationSlug}/admin/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": accessCode
      },
      body: JSON.stringify({
        sessionDate: newSessionDate,
        sessionName: newSessionName
      })
    });

    const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setSaveState(body?.error || body?.message || "Unable to create session.");
      setSessionActionBusy("");
      return;
    }

    setSaveState("Session added successfully.");
    setNewSessionDate("");
    setNewSessionName("");
    setSessionActionBusy("");
    await loadSummary(accessCode, sessionKey, { keepView: true });
  }

  async function handleDeleteSession(sessionKeyToDelete: string) {
    if (!sessionKeyToDelete) return;
    if (!window.confirm("Delete this session and its attendance marks?")) return;

    setSessionActionBusy(sessionKeyToDelete);
    setSaveState("");

    const response = await fetch(`/api/locations/${locationSlug}/admin/sessions`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": accessCode
      },
      body: JSON.stringify({
        sessionKey: sessionKeyToDelete
      })
    });

    const body = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    if (!response.ok) {
      setSaveState(body?.error || body?.message || "Unable to delete session.");
      setSessionActionBusy("");
      return;
    }

    setSaveState("Session deleted successfully.");
    setSessionActionBusy("");
    await loadSummary(accessCode, "", { keepView: true });
  }

  const filteredMasterPeople = useMemo(() => {
    if (!summary) return [];
    const query = normalizeText(masterSearch);
    if (!query) return summary.masterPeople;
    return summary.masterPeople.filter((person) => {
      const haystack = [
        person.name,
        person.mobile,
        person.gender,
        person.college,
        person.branch,
        person.year,
        person.age === null ? "" : String(person.age)
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [masterSearch, summary]);

  const filteredSessions = useMemo(() => {
    if (!summary) return [];
    const query = normalizeText(sessionSearch);
    if (!query) return summary.sessions;
    return summary.sessions.filter((session) => {
      const haystack = [
        session.sessionKey,
        session.sessionLabel,
        session.sessionName,
        session.displayLabel,
        formatDate(session.sessionDate)
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sessionSearch, summary]);

  const filteredAttendance = useMemo(() => {
    if (!summary) return [];
    const query = normalizeText(attendanceSearch);
    if (!query) return summary.selectedSessionAttendance;
    return summary.selectedSessionAttendance.filter((entry) => {
      const haystack = [entry.name, entry.mobile, entry.gender, entry.college, entry.branch]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [attendanceSearch, summary]);

  const filteredRegularFolk = useMemo(() => {
    if (!summary) return [];
    const query = normalizeText(regularSearch);
    if (!query) return summary.regularFolk;
    return summary.regularFolk.filter((entry) => {
      const haystack = [entry.name, entry.mobile, entry.college, entry.branch, entry.gender]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [regularSearch, summary]);

  const activeSession = summary?.sessions.find((entry) => entry.sessionKey === sessionKey) || summary?.sessions[0] || null;

  if (!unlocked || !summary) {
    return (
      <section className="panel adminGate">
        <div className="panelInner">
          <div className="eyebrow" style={{ color: accent }}>
            {subtitle}
          </div>
          <h1 className="publicTitle" style={{ marginTop: 10, marginBottom: 10 }}>
            Admin dashboard for {locationName}
          </h1>
          <p className="publicLead">
            Enter the admin code to unlock the dashboard for this location. The same code opens the master data,
            sessions, attendance, and regular-folk views.
          </p>

          <form className="publicStack" onSubmit={handleUnlock} style={{ marginTop: 20 }}>
            <div className="field">
              <label htmlFor="admin-code">Admin code</label>
              <input
                id="admin-code"
                type="password"
                autoComplete="current-password"
                placeholder="Enter admin code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
              />
            </div>
            <button className="button" type="submit" disabled={loading}>
              {loading ? "Checking..." : "Unlock dashboard"}
            </button>
          </form>

          {error ? (
            <div className="notice noticeDanger publicNotice" style={{ marginTop: 16 }}>
              {error}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  const activeViewMeta = viewMeta.find((item) => item.key === view) || viewMeta[0];

  return (
    <div className="stack">
      <section className="panel adminHero">
        <div className="panelInner">
          <div className="adminTopRow">
            <div>
              <div className="eyebrow" style={{ color: accent }}>
                {subtitle}
              </div>
              <h1 className="title" style={{ marginTop: 12, marginBottom: 10 }}>
                Admin dashboard for {locationName}
              </h1>
              <p className="lead">
                Manage the master registry, edit session names, review session-wise attendance, and inspect the regular
                attendees for this location.
              </p>
            </div>
            <div className="adminStatusCard">
              <div className="metaLabel">Route</div>
              <div className="metaValue">/{locationSlug}/admin</div>
              <div className="statHint" style={{ marginTop: 8 }}>
                Protected by admin code
              </div>
              <button
                type="button"
                className="buttonGhost"
                style={{ marginTop: 14 }}
                onClick={() => {
                  setUnlocked(false);
                  setSummary(null);
                  setError("");
                  setSaveState("");
                }}
              >
                Relock
              </button>
            </div>
          </div>

          <div className="gridCards" style={{ marginTop: 20 }}>
            <div className="statCard">
              <div className="statLabel">Total attendees till now</div>
              <div className="statValue">{summary.totalPeople}</div>
              <div className="statHint">Registered people in the master database</div>
            </div>
            <div className="statCard">
              <div className="statLabel">New attendees in latest session</div>
              <div className="statValue">{summary.latestSessionNewCount}</div>
              <div className="statHint">{summary.latestSessionDisplayLabel}</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Total sessions till now</div>
              <div className="statValue">{summary.totalSessions}</div>
              <div className="statHint">All recorded attendance sessions</div>
            </div>
            <div className="statCard">
              <div className="statLabel">Date of latest session</div>
              <div className="statValue" style={{ fontSize: 22, lineHeight: 1.2 }}>
                {formatDate(summary.sessions[summary.sessions.length - 1]?.sessionDate || summary.currentSession.sessionDate)}
              </div>
              <div className="statHint">{summary.latestSessionDisplayLabel}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelInner">
          <div className="sectionHeader">
            <div>
              <div className="eyebrow" style={{ color: accent }}>
                Dashboard views
              </div>
              <h2 className="sectionTitle" style={{ marginTop: 8 }}>
                {activeViewMeta.label}
              </h2>
              <p className="sectionNote">{activeViewMeta.hint}</p>
            </div>
            <div className="adminViewGrid">
              {viewMeta.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`adminViewButton ${view === item.key ? "adminViewButtonActive" : ""}`}
                  onClick={() => setView(item.key)}
                >
                  <span>{item.label}</span>
                  <small>{item.hint}</small>
                </button>
              ))}
            </div>
          </div>

          {saveState ? <div className="notice publicNotice">{saveState}</div> : null}
          {error ? <div className="notice noticeDanger publicNotice">{error}</div> : null}

          {view === "master" ? (
            <div className="stack">
              <div className="adminToolbar">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="master-search">Search</label>
                  <input
                    id="master-search"
                    placeholder="Search master data"
                    value={masterSearch}
                    onChange={(event) => setMasterSearch(event.target.value)}
                  />
                </div>
                <button
                  className="buttonSecondary"
                  type="button"
                  onClick={() =>
                    downloadXlsx(
                      `${locationSlug}-master-data.xlsx`,
                      "Master Data",
                      filteredMasterPeople.map((person, index) => ({
                        "S No": index + 1,
                        Name: person.name,
                        Mobile: person.mobile,
                        Age: person.age ?? "",
                        Gender: person.gender,
                        College: person.college,
                        Branch: person.branch,
                        Year: person.year,
                        "Profile Complete": person.profileComplete ? "Yes" : "No",
                        "Created At": person.createdAt,
                        "Updated At": person.updatedAt
                      }))
                    )
                  }
                >
                  Export Excel
                </button>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S No</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Age</th>
                      <th>Gender</th>
                      <th>College</th>
                      <th>Branch</th>
                      <th>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterPeople.map((person, index) => (
                      <tr key={person.id}>
                        <td>{index + 1}</td>
                        <td>{person.name}</td>
                        <td>{person.mobile}</td>
                        <td>{person.age ?? "-"}</td>
                        <td>{person.gender || "-"}</td>
                        <td>{person.college || "-"}</td>
                        <td>{person.branch || "-"}</td>
                        <td>{person.year || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view === "sessions" ? (
            <div className="stack">
              <div className="panel" style={{ background: "rgba(44, 126, 247, 0.05)" }}>
                <div className="panelInner">
                  <div className="sectionHeader" style={{ marginBottom: 12 }}>
                    <div>
                      <h3 className="sectionTitle">Add session</h3>
                      <p className="sectionNote">Create a new session by choosing its date and optional name.</p>
                    </div>
                  </div>
                  <div className="adminToolbar">
                    <div className="field" style={{ minWidth: 220 }}>
                      <label htmlFor="new-session-date">Session date</label>
                      <input
                        id="new-session-date"
                        type="date"
                        value={newSessionDate}
                        onChange={(event) => setNewSessionDate(event.target.value)}
                      />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label htmlFor="new-session-name">Session name</label>
                      <input
                        id="new-session-name"
                        placeholder="Optional session name"
                        value={newSessionName}
                        onChange={(event) => setNewSessionName(event.target.value)}
                      />
                    </div>
                    <button className="buttonSecondary" type="button" onClick={() => void handleCreateSession()} disabled={sessionActionBusy === "create"}>
                      {sessionActionBusy === "create" ? "Adding..." : "Add session"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="adminToolbar">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="session-search">Search</label>
                  <input
                    id="session-search"
                    placeholder="Search sessions"
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                  />
                </div>
                <div className="heroActions" style={{ marginTop: 0 }}>
                  <button className="buttonSecondary" type="button" onClick={() => void handleSaveSessions()} disabled={savingSessions}>
                    {savingSessions ? "Saving..." : "Save session edits"}
                  </button>
                  <button
                    className="buttonSecondary"
                    type="button"
                    onClick={() =>
                      downloadXlsx(
                        `${locationSlug}-sessions-master.xlsx`,
                        "Sessions Master",
                        filteredSessions.map((session, index) => ({
                          "S No": index + 1,
                          "Session Date": formatDate(session.sessionDate),
                          "Session Name": session.sessionName || "",
                          "Display Label": session.displayLabel,
                          "Session Key": session.sessionKey,
                          "Present Count": session.presentCount,
                          "New Attendees": session.newAttendeesCount
                        }))
                      )
                    }
                  >
                    Export Excel
                  </button>
                </div>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S No</th>
                      <th>Session Date</th>
                      <th>Session Name</th>
                      <th>Edit Date</th>
                      <th>Display Label</th>
                      <th>Present</th>
                      <th>New</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session, index) => (
                      <tr key={session.sessionKey}>
                        <td>{index + 1}</td>
                        <td>{formatDate(session.sessionDate)}</td>
                        <td style={{ minWidth: 240 }}>
                          <input
                            className="inlineInput"
                            value={sessionDrafts[session.sessionKey] ?? ""}
                            placeholder="Add a session name"
                            onChange={(event) =>
                              setSessionDrafts((current) => ({
                                ...current,
                                [session.sessionKey]: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td style={{ minWidth: 180 }}>
                          <input
                            className="inlineInput"
                            type="date"
                            value={sessionDateDrafts[session.sessionKey] ?? ""}
                            onChange={(event) =>
                              setSessionDateDrafts((current) => ({
                                ...current,
                                [session.sessionKey]: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td>{session.displayLabel}</td>
                        <td>{session.presentCount}</td>
                        <td>{session.newAttendeesCount}</td>
                        <td>
                          <button
                            className="buttonGhost"
                            type="button"
                            onClick={() => void handleDeleteSession(session.sessionKey)}
                            disabled={sessionActionBusy === session.sessionKey}
                          >
                            {sessionActionBusy === session.sessionKey ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view === "attendance" ? (
            <div className="stack">
              <div className="adminToolbar">
                <div className="field" style={{ minWidth: 260 }}>
                  <label htmlFor="session-key">Session</label>
                  <select
                    id="session-key"
                    value={sessionKey}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSessionKey(next);
                      void loadSummary(accessCode, next, { keepView: true });
                    }}
                  >
                    {summary.sessions.map((session) => (
                      <option key={session.sessionKey} value={session.sessionKey}>
                        {session.displayLabel}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="attendance-search">Search</label>
                  <input
                    id="attendance-search"
                    placeholder="Search attendance"
                    value={attendanceSearch}
                    onChange={(event) => setAttendanceSearch(event.target.value)}
                  />
                </div>
                <button
                  className="buttonSecondary"
                  type="button"
                  onClick={() =>
                    downloadXlsx(
                      `${locationSlug}-attendance-${sessionKey || summary.selectedSessionKey}.xlsx`,
                      "Session Attendance",
                      filteredAttendance.map((entry, index) => ({
                        "S No": index + 1,
                        Name: entry.name,
                        Mobile: entry.mobile,
                        Gender: entry.gender,
                        College: entry.college,
                        Branch: entry.branch,
                        "Marked At": entry.markedAt
                      }))
                    )
                  }
                >
                  Export Excel
                </button>
              </div>

              <div className="notice">
                Viewing <strong>{activeSession?.displayLabel || summary.currentSession.displayLabel}</strong> with{" "}
                <strong>{filteredAttendance.length}</strong> present attendees.
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S No</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>Gender</th>
                      <th>College</th>
                      <th>Branch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendance.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>{entry.name}</td>
                        <td>{entry.mobile}</td>
                        <td>{entry.gender || "-"}</td>
                        <td>{entry.college || "-"}</td>
                        <td>{entry.branch || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view === "regular" ? (
            <div className="stack">
              <div className="adminToolbar">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor="regular-search">Search</label>
                  <input
                    id="regular-search"
                    placeholder="Search regular folk"
                    value={regularSearch}
                    onChange={(event) => setRegularSearch(event.target.value)}
                  />
                </div>
                <button
                  className="buttonSecondary"
                  type="button"
                  onClick={() =>
                    downloadXlsx(
                      `${locationSlug}-regular-folk.xlsx`,
                      "Regular Folk",
                      filteredRegularFolk.map((entry, index) => ({
                        "S No": index + 1,
                        Name: entry.name,
                        Mobile: entry.mobile,
                        College: entry.college,
                        Branch: entry.branch,
                        Gender: entry.gender,
                        "Sessions Attended": entry.presentSessions,
                        "Attendance %": Number(entry.attendanceRate.toFixed(1))
                      }))
                    )
                  }
                >
                  Export Excel
                </button>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S No</th>
                      <th>Name</th>
                      <th>Mobile</th>
                      <th>College</th>
                      <th>Branch</th>
                      <th>Sessions</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRegularFolk.map((entry, index) => (
                      <tr key={entry.id}>
                        <td>{index + 1}</td>
                        <td>{entry.name}</td>
                        <td>{entry.mobile}</td>
                        <td>{entry.college || "-"}</td>
                        <td>{entry.branch || "-"}</td>
                        <td>{entry.presentSessions}</td>
                        <td>{toPercent(entry.attendanceRate / 100)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
