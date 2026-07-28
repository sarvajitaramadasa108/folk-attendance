"use client";

import { useEffect, useMemo, useState } from "react";
import { toPercent } from "@/lib/format";

type Summary = {
  locationSlug: string;
  currentSession: { sessionKey: string; sessionLabel: string };
  selectedSessionKey: string;
  totalPeople: number;
  totalSessions: number;
  sessions: Array<{
    id: string;
    sessionKey: string;
    sessionLabel: string;
    presentCount: number;
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

const STORAGE_PREFIX = "folk-admin-key:";

export function AdminDashboard({ locationSlug, locationName, accent, subtitle }: Props) {
  const [accessCode, setAccessCode] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReplace, setImportReplace] = useState(true);
  const [importStatus, setImportStatus] = useState("");
  const [importBusy, setImportBusy] = useState(false);

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${locationSlug}`, [locationSlug]);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setAccessCode(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  async function loadSummary(code = accessCode, selectedSessionKey = sessionKey) {
    setLoading(true);
    setError("");

    const search = new URLSearchParams();
    if (selectedSessionKey) {
      search.set("sessionKey", selectedSessionKey);
    }

    const response = await fetch(`/api/locations/${locationSlug}/admin/summary?${search.toString()}`, {
      headers: {
        "x-admin-key": code
      }
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const body = raw ? (() => {
        try {
          return JSON.parse(raw) as { error?: string };
        } catch {
          return null;
        }
      })() : null;
      setError(body?.error || raw || `Unable to load admin data (${response.status}).`);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as Summary;
    setSummary(data);
    setSessionKey(data.selectedSessionKey);
    setLoading(false);
  }

  async function handleAccess(e: React.FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(storageKey, accessCode);
    await loadSummary(accessCode, sessionKey);
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importFile) {
      setImportStatus("Please choose a workbook file first.");
      return;
    }

    setImportBusy(true);
    setImportStatus("");

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("replace", String(importReplace));

    const response = await fetch(`/api/locations/${locationSlug}/admin/import`, {
      method: "POST",
      headers: {
        "x-admin-key": accessCode
      },
      body: formData
    });

    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setImportStatus(body?.error || "Import failed.");
      setImportBusy(false);
      return;
    }

    setImportStatus(
      `Imported ${body.peopleImported} people, ${body.sessionsImported} sessions, and ${body.attendanceMarksImported} marks.`
    );
    setImportBusy(false);
    await loadSummary(accessCode, sessionKey);
  }

  const selectedSession = summary?.sessions.find((item) => item.sessionKey === sessionKey);

  return (
    <div className="panel">
      <div className="panelInner">
        <div className="eyebrow" style={{ color: accent }}>
          {subtitle}
        </div>
        <h2 className="sectionTitle" style={{ marginTop: 8 }}>
          Admin dashboard for {locationName}
        </h2>
        <p className="sectionNote">
          View the master registry, session-wise attendance, and regular-folk rankings from the same location dataset.
        </p>

        <form className="heroActions" onSubmit={handleAccess} style={{ marginTop: 18 }}>
          <input
            aria-label="Admin access code"
            className="fieldInput"
            style={{
              minWidth: 260,
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,0.04)",
              color: "var(--text)",
              padding: "12px 16px"
            }}
            placeholder="Admin access code"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
          />
          <button className="buttonSecondary" type="submit" disabled={loading}>
            {loading ? "Loading..." : "Unlock dashboard"}
          </button>
        </form>

        {error ? (
          <div className="notice" style={{ marginTop: 14, borderColor: "rgba(255,140,140,0.3)" }}>
            {error}
          </div>
        ) : null}

        {summary ? (
          <>
            <div className="section" style={{ marginTop: 20 }}>
              <div className="panel">
                <div className="panelInner">
                  <div className="sectionHeader" style={{ marginBottom: 10 }}>
                    <div>
                      <h3 className="sectionTitle">Import workbook</h3>
                      <p className="sectionNote">
                        Upload the existing `FOLK MVP.xlsx` file to seed MongoDB for this location.
                      </p>
                    </div>
                  </div>
                  <form className="formGrid" onSubmit={handleImport}>
                    <div className="fieldGrid">
                      <div className="field">
                        <label htmlFor="workbook">Workbook file</label>
                        <input
                          id="workbook"
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={(event) => setImportFile(event.target.files?.[0] || null)}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor="replace">Import mode</label>
                        <select
                          id="replace"
                          value={String(importReplace)}
                          onChange={(event) => setImportReplace(event.target.value === "true")}
                        >
                          <option value="true">Replace existing location data</option>
                          <option value="false">Keep existing data and merge</option>
                        </select>
                      </div>
                    </div>
                    <div className="heroActions" style={{ marginTop: 4 }}>
                      <button className="button" type="submit" disabled={importBusy}>
                        {importBusy ? "Importing..." : "Import workbook into MongoDB"}
                      </button>
                    </div>
                  </form>
                  {importStatus ? (
                    <div className="notice" style={{ marginTop: 14 }}>
                      {importStatus}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="section" style={{ marginTop: 20 }}>
              <div className="gridCards">
                <div className="statCard">
                  <div className="statLabel">People in registry</div>
                  <div className="statValue">{summary.totalPeople}</div>
                  <div className="statHint">Master data rows for this location</div>
                </div>
                <div className="statCard">
                  <div className="statLabel">Sessions recorded</div>
                  <div className="statValue">{summary.totalSessions}</div>
                  <div className="statHint">Session-wise attendance history</div>
                </div>
                <div className="statCard">
                  <div className="statLabel">Selected session present</div>
                  <div className="statValue">{summary.selectedSessionAttendance.length}</div>
                  <div className="statHint">{selectedSession?.sessionLabel || summary.currentSession.sessionLabel}</div>
                </div>
                <div className="statCard">
                  <div className="statLabel">Regular folk</div>
                  <div className="statValue">{summary.regularFolk.length}</div>
                  <div className="statHint">Male members ranked by sessions attended</div>
                </div>
              </div>
            </div>

            <div className="section">
              <div className="sectionHeader">
                <div>
                  <h3 className="sectionTitle">Session wise attendance</h3>
                  <p className="sectionNote">Pick a session to see the exact attendees for that day.</p>
                </div>
                <select
                  value={sessionKey}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSessionKey(next);
                    void loadSummary(accessCode, next);
                  }}
                  style={{
                    minWidth: 240,
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    background: "rgba(255,255,255,0.04)",
                    color: "var(--text)",
                    padding: "12px 14px"
                  }}
                >
                  {summary.sessions.map((session) => (
                    <option key={session.sessionKey} value={session.sessionKey}>
                      {session.sessionLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tableWrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Present</th>
                      <th>Attendance rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.sessions.map((session) => (
                      <tr key={session.sessionKey}>
                        <td>{session.sessionLabel}</td>
                        <td>{session.presentCount}</td>
                        <td>{summary.totalPeople ? toPercent(session.presentCount / summary.totalPeople) : "0%"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="section">
              <div className="panelGrid">
                <div className="panel">
                  <div className="panelInner">
                    <div className="sectionHeader" style={{ marginBottom: 10 }}>
                      <div>
                        <h3 className="sectionTitle">Master data</h3>
                        <p className="sectionNote">Imported people list from the workbook or kiosk registrations.</p>
                      </div>
                    </div>
                    <div className="tableWrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Mobile</th>
                            <th>College</th>
                            <th>Branch</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.masterPeople.map((person) => (
                            <tr key={person.id}>
                              <td>{person.name}</td>
                              <td>{person.mobile}</td>
                              <td>{person.college || "-"}</td>
                              <td>{person.branch || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="split">
                  <div className="panel">
                    <div className="panelInner">
                      <div className="sectionHeader" style={{ marginBottom: 10 }}>
                        <div>
                          <h3 className="sectionTitle">Present in selected session</h3>
                          <p className="sectionNote">This matches the session column view from the spreadsheet.</p>
                        </div>
                      </div>
                      <div className="tableWrap">
                        <table className="table tableSmall">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Mobile</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.selectedSessionAttendance.map((person) => (
                              <tr key={person.id}>
                                <td>{person.name}</td>
                                <td>{person.mobile}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="panelInner">
                      <div className="sectionHeader" style={{ marginBottom: 10 }}>
                        <div>
                          <h3 className="sectionTitle">Regular folk</h3>
                          <p className="sectionNote">Top male attendees by sessions present.</p>
                        </div>
                      </div>
                      <div className="tableWrap">
                        <table className="table tableSmall">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Sessions</th>
                              <th>Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.regularFolk.slice(0, 12).map((person) => (
                              <tr key={person.id}>
                                <td>{person.name}</td>
                                <td>{person.presentSessions}</td>
                                <td>{person.attendanceRate.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
