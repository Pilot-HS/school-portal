"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Copy, Printer, Pencil, Eye } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import ClassSelect from "@/components/ClassSelect";
import AttendanceMarker from "@/components/AttendanceMarker";
import AttendanceRegister from "@/components/AttendanceRegister";
import HolidayManager from "@/components/HolidayManager";
import { addDays } from "@/lib/attendanceStats";
import { formatDate, localISODate } from "@/lib/teacherUi";

type Tab = "overview" | "register" | "alerts" | "holidays" | "settings";
const SCHOOL = "Government Boys High School, P.H. Pilot, Dadu";

async function api(path: string, method = "GET", body?: any) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

const STATUS_PILL: Record<string, [string, string]> = {
  marked: ["pill-green", "Marked"],
  partial: ["pill-amber", "Partly marked"],
  not_marked: ["pill-red", "Not marked"],
  sunday: ["pill-gray", "Sunday"],
  holiday: ["pill-amber", "Holiday"],
  empty: ["pill-gray", "No students"],
};

export default function AdminAttendancePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  // overview
  const [date, setDate] = useState(localISODate());
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openClass, setOpenClass] = useState("");
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // alerts
  const [aFrom, setAFrom] = useState(addDays(localISODate(), -29));
  const [aTo, setATo] = useState(localISODate());
  const [aClass, setAClass] = useState("");
  const [alerts, setAlerts] = useState<any>(null);
  const [aLoading, setALoading] = useState(false);
  const [aError, setAError] = useState("");

  // settings
  const [lockDays, setLockDays] = useState("0");
  const [lowLimit, setLowLimit] = useState("70");
  const [sMsg, setSMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [sBusy, setSBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const [{ data: profile }, { data: cls }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("classes").select("*").order("grade"),
      ]);
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setClasses(cls || []);
      const s = await api("/api/admin/attendance-settings");
      if (s.ok) {
        setLockDays(String(s.json.lockDays));
        setLowLimit(String(s.json.lowThreshold));
      }
      setReady(true);
    })();
  }, [router]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    const { ok, json } = await api(`/api/admin/attendance-overview?date=${date}`);
    if (!ok) setError(json.error || "Could not load the overview.");
    else setOverview(json);
    setLoading(false);
  }, [date]);

  useEffect(() => {
    if (ready && tab === "overview") {
      setOpenClass("");
      setEditing(false);
      loadOverview();
    }
  }, [ready, tab, loadOverview]);

  const loadAlerts = useCallback(async () => {
    setALoading(true);
    setAError("");
    const qs = new URLSearchParams({ from: aFrom, to: aTo });
    if (aClass) qs.set("class_id", aClass);
    const { ok, json } = await api(`/api/admin/attendance-alerts?${qs.toString()}`);
    if (!ok) setAError(json.error || "Could not work out the alerts.");
    else setAlerts(json);
    setALoading(false);
  }, [aFrom, aTo, aClass]);

  useEffect(() => {
    if (ready && tab === "alerts") {
      const t = setTimeout(loadAlerts, 250);
      return () => clearTimeout(t);
    }
  }, [ready, tab, loadAlerts]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSBusy(true);
    setSMsg(null);
    const { ok, json } = await api("/api/admin/attendance-settings", "POST", { lock_days: Number(lockDays), low_threshold: Number(lowLimit) });
    setSMsg(ok ? { type: "success", text: "Settings saved." } : { type: "error", text: json.error || "Could not save." });
    setSBusy(false);
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  const rows: any[] = overview?.classes || [];
  const notMarked = rows.filter((c) => c.status === "not_marked" || c.status === "partial");
  const withAbsent = rows.filter((c) => c.absentees.length > 0);
  const totalStudents = rows.reduce((a, c) => a + c.total, 0);
  const totalMarked = rows.reduce((a, c) => a + c.marked, 0);
  const totalAttended = rows.reduce((a, c) => a + c.present + c.late, 0);
  const schoolPct = totalMarked > 0 ? Math.round((totalAttended / totalMarked) * 100) : null;

  const absentText = `📋 *${SCHOOL}*\n*Absent students — ${formatDate(date)}*\n\n` + withAbsent.map((c) => `*Class ${c.name}* (${c.absentees.length})\n${c.absentees.join("\n")}`).join("\n\n");
  async function copyAbsent() {
    try {
      await navigator.clipboard.writeText(absentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this text:", absentText);
    }
  }

  const tabs: [Tab, string][] = [["overview", "Overview"], ["register", "Register & print"], ["alerts", "Alerts"], ["holidays", "Holidays"], ["settings", "Settings"]];

  return (
    <AdminLayout active="attendance" fullName={fullName}>
      <h1 className="t-page-title no-print">Attendance</h1>
      <div className="t-segment no-print" role="tablist" style={{ maxWidth: "100%", overflowX: "auto" }}>
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === "overview" && (
        <div className="no-print">
          <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: 0 }}>
            Teachers mark attendance. Here you can see what was marked, and edit any student&apos;s attendance if something is wrong.
          </p>
          <div className="portal-panel" style={{ maxWidth: 420 }}>
            <div className="form-field" style={{ marginBottom: 0 }}>
              <label htmlFor="ov_date">Date</label>
              <input id="ov_date" type="date" max={localISODate()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
          </div>

          {error && <div className="t-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={loadOverview}>Try again</button></div>}
          {loading && !overview && <div className="skeleton" style={{ height: 240 }} />}

          {overview && (
            <>
              {overview.is_sunday && <div className="att-banner sun">{formatDate(date)} is a <strong>Sunday</strong>.</div>}
              <div className="t-stats">
                <div className="t-stat"><div><div className="t-stat-num">{rows.filter((c) => c.status === "marked").length}/{rows.filter((c) => c.status !== "empty" && c.status !== "holiday" && c.status !== "sunday").length}</div><div className="t-stat-label">Classes fully marked</div></div></div>
                <div className="t-stat"><div><div className="t-stat-num">{schoolPct === null ? "—" : `${schoolPct}%`}</div><div className="t-stat-label">Present (incl. late)</div></div></div>
                <div className="t-stat"><div><div className="t-stat-num">{rows.reduce((a, c) => a + c.absent, 0)}</div><div className="t-stat-label">Absent</div></div></div>
                <div className="t-stat"><div><div className="t-stat-num">{totalMarked}/{totalStudents}</div><div className="t-stat-label">Students marked</div></div></div>
              </div>

              <div className="portal-panel">
                <h2>Classes on {formatDate(date)}</h2>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead><tr><th>Class</th><th>Status</th><th>P</th><th>Lt</th><th>A</th><th>Lv</th><th>%</th><th>Marked by</th><th></th></tr></thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.class_id}>
                          <td><strong>{c.name}</strong></td>
                          <td>
                            <span className={`pill ${STATUS_PILL[c.status][0]}`}>{STATUS_PILL[c.status][1]}</span>
                            {c.holiday_reason && <div className="t-test-meta">{c.holiday_reason}</div>}
                          </td>
                          <td>{c.present}</td><td>{c.late}</td><td>{c.absent}</td><td>{c.leave}</td>
                          <td>{c.pct === null ? "—" : `${c.pct}%`}</td>
                          <td>{c.marked_by.length ? c.marked_by.join(", ") : c.marked > 0 ? "Admin" : "—"}</td>
                          <td>
                            {c.status !== "sunday" && c.status !== "empty" && (
                              <button className="btn btn-outline" style={{ padding: "5px 12px", fontSize: "0.8rem" }} onClick={() => { setOpenClass(openClass === c.class_id ? "" : c.class_id); setEditing(false); }}>
                                {openClass === c.class_id ? "Close" : "View"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {openClass && (
                <div style={{ marginBottom: 20 }}>
                  <div className="t-row-between" style={{ marginBottom: 10 }}>
                    <h2 className="t-section-title" style={{ margin: 0 }}>Class {rows.find((c) => c.class_id === openClass)?.name} — {formatDate(date)}</h2>
                    <button className={`btn ${editing ? "btn-outline" : "btn-primary"}`} onClick={() => setEditing((v) => !v)}>
                      {editing ? <><Eye size={15} /> Stop editing</> : <><Pencil size={15} /> Edit attendance</>}
                    </button>
                  </div>
                  <AttendanceMarker classId={openClass} date={date} isAdmin readOnly={!editing} onSaved={loadOverview} />
                </div>
              )}

              <div className="t-grid">
                <div className="portal-panel">
                  <h2>Not marked yet</h2>
                  {notMarked.length === 0 ? (
                    <div className="t-empty">Every class has been marked.</div>
                  ) : (
                    notMarked.map((c) => (
                      <div className="t-period" key={c.class_id}>
                        <div className="t-period-no">{c.name}</div>
                        <div>
                          <div className="t-period-subject">{c.status === "partial" ? `Only ${c.marked} of ${c.total} marked` : "Not marked"}</div>
                          <div className="t-period-class">{c.teachers.length ? `Teachers: ${c.teachers.join(", ")}` : "No teacher in the timetable"}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="portal-panel">
                  <div className="t-row-between" style={{ flexWrap: "wrap", gap: 8 }}>
                    <h2 style={{ margin: 0 }}>Absent students</h2>
                    {withAbsent.length > 0 && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <a className="btn btn-primary" style={{ background: "#25a244", borderColor: "#25a244", padding: "6px 12px", fontSize: "0.8rem" }} href={`https://wa.me/?text=${encodeURIComponent(absentText)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} /> WhatsApp</a>
                        <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={copyAbsent}><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
                      </div>
                    )}
                  </div>
                  {withAbsent.length === 0 ? (
                    <div className="t-empty">No absentees recorded.</div>
                  ) : (
                    withAbsent.map((c) => (
                      <div key={c.class_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                        <strong>Class {c.name}</strong> <span className="pill pill-red">{c.absentees.length}</span>
                        <div style={{ fontSize: "0.85rem", color: "var(--slate)", marginTop: 4 }}>{c.absentees.join(" · ")}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "register" && <AttendanceRegister mode="class" classes={classes} myClassIds={[]} canEdit />}

      {tab === "alerts" && (
        <>
          <div className="no-print">
            <div className="portal-panel">
              <div className="t-form-grid">
                <div className="form-field">
                  <label htmlFor="al_class">Class</label>
                  <ClassSelect id="al_class" value={aClass} onChange={setAClass} classes={classes} myClassIds={[]} placeholder="All classes" />
                </div>
                <div className="form-field" />
                <div className="form-field">
                  <label htmlFor="al_from">From</label>
                  <input id="al_from" type="date" max={aTo} value={aFrom} onChange={(e) => setAFrom(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="al_to">To</label>
                  <input id="al_to" type="date" min={aFrom} value={aTo} onChange={(e) => setATo(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => window.print()} disabled={!alerts}><Printer size={15} /> Print this list</button>
            </div>
            {aError && <div className="t-error" role="alert"><span>{aError}</span><button className="btn btn-outline" onClick={loadAlerts}>Try again</button></div>}
            {aLoading && !alerts && <div className="skeleton" style={{ height: 200 }} />}
          </div>

          {alerts && (
            <div className="print-sheet">
              <div className="ar-head print-only">
                <div className="ar-school">{SCHOOL}</div>
                <div className="ar-title">Attendance alerts — {formatDate(alerts.from)} to {formatDate(alerts.to)}</div>
              </div>

              <div className="portal-panel">
                <h2>Below {alerts.threshold}% attendance <span className="pill pill-red">{alerts.low.length}</span></h2>
                <p className="t-hint no-print" style={{ marginTop: 0 }}>Only students with at least 5 marked days in this period are listed. Sundays and holidays are not counted.</p>
                {alerts.low.length === 0 ? (
                  <div className="t-empty">No student is below {alerts.threshold}%.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>Class</th><th>Roll</th><th>Name</th><th>Attendance</th><th>Absent days</th><th>Days marked</th></tr></thead>
                      <tbody>
                        {alerts.low.map((s: any) => (
                          <tr key={s.id}><td>{s.class_name}</td><td>{s.roll_no}</td><td>{s.name}</td><td><span className="pill pill-red">{s.pct}%</span></td><td>{s.absent}</td><td>{s.marked}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="portal-panel">
                <h2>Absent 3 or more days in a row <span className="pill pill-amber">{alerts.streaks.length}</span></h2>
                {alerts.streaks.length === 0 ? (
                  <div className="t-empty">No student has been absent for 3 or more working days in a row.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="data-table">
                      <thead><tr><th>Class</th><th>Roll</th><th>Name</th><th>Days in a row</th><th>Absent since</th></tr></thead>
                      <tbody>
                        {alerts.streaks.map((s: any) => (
                          <tr key={s.id}><td>{s.class_name}</td><td>{s.roll_no}</td><td>{s.name}</td><td><span className="pill pill-red">{s.days}</span></td><td>{formatDate(s.since)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="ar-sign print-only">
                <div><span />Class Teacher</div>
                <div><span />Principal / Head Master</div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "holidays" && (
        <div className="no-print">
          <HolidayManager classes={classes} myClassIds={[]} isAdmin />
        </div>
      )}

      {tab === "settings" && (
        <form className="portal-panel no-print" onSubmit={saveSettings} style={{ maxWidth: 560 }}>
          <h2>Attendance settings</h2>
          <div className="form-field">
            <label htmlFor="s_lock">Lock old attendance for teachers after (days)</label>
            <input id="s_lock" type="number" min={0} max={365} value={lockDays} onChange={(e) => setLockDays(e.target.value)} />
            <p className="t-hint" style={{ margin: "4px 0 0" }}>0 means teachers can always change past attendance. For example, 3 means teachers can only mark or change the last 3 days. You can always change any date.</p>
          </div>
          <div className="form-field">
            <label htmlFor="s_low">Low attendance limit (%)</label>
            <input id="s_low" type="number" min={1} max={100} value={lowLimit} onChange={(e) => setLowLimit(e.target.value)} />
            <p className="t-hint" style={{ margin: "4px 0 0" }}>Students below this are listed under Alerts and shown in red on the register.</p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={sBusy}>{sBusy ? "Saving…" : "Save settings"}</button>
          {sMsg && <p className={sMsg.type === "success" ? "success-text" : "error-text"} role="status">{sMsg.text}</p>}
        </form>
      )}
    </AdminLayout>
  );
}
