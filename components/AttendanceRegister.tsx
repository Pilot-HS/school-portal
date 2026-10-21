"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Download } from "lucide-react";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";
import { addDays, dayInfos, DayInfo, monthChunks, STATUS_CODE, STATUS_LABEL, totalsFor } from "@/lib/attendanceStats";
import { formatDate, localISODate } from "@/lib/teacherUi";

const SCHOOL = "Government Boys High School, P.H. Pilot, Dadu";
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];
const dayNumber = (d: string) => String(parseInt(d.slice(8), 10));
const weekdayOf = (d: string) => WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()];
const weekdayLong = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });

// Attendance between two dates: per-student totals, a printable register (one table per month),
// a CSV download and, for one student, a day-by-day list.
export default function AttendanceRegister({
  mode,
  classes = [],
  myClassIds = [],
  studentId,
  canEdit = false,
  defaultClassId = "",
}: {
  mode: "class" | "student";
  classes?: any[];
  myClassIds?: string[];
  studentId?: string;
  canEdit?: boolean;
  defaultClassId?: string;
}) {
  const today = localISODate();
  const [classId, setClassId] = useState(defaultClassId || myClassIds[0] || "");
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [pick, setPick] = useState(""); // single student inside a class
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    if (mode === "class" && !classId) return;
    if (!from || !to || to < from) return;
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ from, to });
    if (mode === "student" && studentId) qs.set("student_id", studentId);
    else qs.set("class_id", classId);
    const { ok, data: d } = await teacherApi(`/api/attendance/range?${qs.toString()}`);
    if (!ok) {
      setError(d.error || "Could not load attendance.");
      setData(null);
    } else setData(d);
    setLoading(false);
  }, [mode, classId, studentId, from, to]);

  useEffect(() => {
    setPick("");
  }, [classId]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const holidays = data?.holidays || [];
  const effectiveClass: string | null = data?.class_id || null;
  const days: DayInfo[] = useMemo(() => (data ? dayInfos(from, to, holidays, effectiveClass, data.today) : []), [data, from, to, holidays, effectiveClass]);
  const allStudents: any[] = data?.students || [];
  const students = mode === "class" && pick ? allStudents.filter((s) => s.id === pick) : allStudents;
  const single = students.length === 1 ? students[0] : null;
  const threshold: number = data?.low_threshold || 70;

  const rangeText = `${formatDate(from)} to ${formatDate(to)}`;
  const defaultTitle = single
    ? `${single.full_name} — Attendance Report — ${rangeText}`
    : `${data?.class_name ? `Class ${data.class_name}` : "Class"} Attendance Register — ${rangeText}`;
  useEffect(() => {
    if (!titleEdited) setTitle(defaultTitle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTitle, titleEdited]);

  const workingDays = days.filter((d) => d.kind === "working").length;
  const sundays = days.filter((d) => d.kind === "sunday").length;
  const holidayDays = days.filter((d) => d.kind === "holiday");
  const reasonList = Array.from(new Map(holidayDays.map((d) => [d.date, d.reason || "Holiday"])).entries());

  function quick(kind: "month" | "last" | "30") {
    const t = new Date();
    if (kind === "month") {
      setFrom(today.slice(0, 8) + "01");
      setTo(today);
    } else if (kind === "last") {
      const first = new Date(Date.UTC(t.getFullYear(), t.getMonth() - 1, 1));
      const last = new Date(Date.UTC(t.getFullYear(), t.getMonth(), 0));
      setFrom(first.toISOString().slice(0, 10));
      setTo(last.toISOString().slice(0, 10));
    } else {
      setFrom(addDays(today, -29));
      setTo(today);
    }
  }

  const cellOf = (d: DayInfo, rec?: Record<string, string>) => (d.kind === "sunday" ? "S" : d.kind === "holiday" ? "H" : d.kind === "future" ? "" : STATUS_CODE[rec?.[d.date] || ""] || "");
  const cellClass = (d: DayInfo, rec?: Record<string, string>) =>
    d.kind === "sunday" ? "ar-sun" : d.kind === "holiday" ? "ar-hol" : rec?.[d.date] === "absent" ? "ar-abs" : rec?.[d.date] === "late" ? "ar-late" : "";

  function downloadCsv() {
    const header = ["Roll No", "Name", ...days.map((d) => d.date), "Present", "Late", "Absent", "Leave", "Not marked", "Attendance %"];
    const rows = students.map((s) => {
      const rec = data.records[s.id];
      const t = totalsFor(days, rec);
      return [s.roll_no, s.full_name, ...days.map((d) => cellOf(d, rec)), t.present, t.late, t.absent, t.leave, t.notMarked, t.pct === null ? "" : `${t.pct}%`];
    });
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function changeDay(date: string, status: string) {
    if (!single || !effectiveClass) return;
    setMsg(null);
    const { ok, data: d } = await teacherApi("/api/teacher/mark-attendance", {
      body: { class_id: effectiveClass, date, records: [{ student_id: single.id, status }], reason: editReason },
    });
    if (!ok) setMsg({ type: "error", text: d.error || "Could not save the change." });
    else {
      setMsg({ type: "success", text: `Changed ${formatDate(date)} to ${STATUS_LABEL[status]}.` });
      await load();
    }
  }

  const monthTables = monthChunks(days);

  return (
    <>
      <style>{`@media print { @page { size: A4 landscape; margin: 8mm; } }`}</style>

      <div className="no-print">
        <div className="portal-panel">
          <div className="t-form-grid">
            {mode === "class" && (
              <>
                <div className="form-field">
                  <label htmlFor="ar_class">Class</label>
                  <ClassSelect id="ar_class" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
                </div>
                <div className="form-field">
                  <label htmlFor="ar_student">Student</label>
                  <select id="ar_student" value={pick} onChange={(e) => setPick(e.target.value)} disabled={!allStudents.length}>
                    <option value="">All students</option>
                    {allStudents.map((s) => <option key={s.id} value={s.id}>{s.roll_no}. {s.full_name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div className="form-field">
              <label htmlFor="ar_from">From</label>
              <input id="ar_from" type="date" max={to} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="ar_to">To</label>
              <input id="ar_to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button className="btn btn-outline" onClick={() => quick("month")}>This month</button>
            <button className="btn btn-outline" onClick={() => quick("last")}>Last month</button>
            <button className="btn btn-outline" onClick={() => quick("30")}>Last 30 days</button>
          </div>
          <div className="form-field">
            <label htmlFor="ar_title">Title on the printout</label>
            <input id="ar_title" value={title} onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); }} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={!data || students.length === 0}><Printer size={15} /> Print</button>
            <button className="btn btn-outline" onClick={downloadCsv} disabled={!data || students.length === 0}><Download size={15} /> Download Excel (CSV)</button>
            {titleEdited && <button className="btn btn-outline" onClick={() => setTitleEdited(false)}>Reset title</button>}
          </div>
          <p className="t-hint">Sundays show as <strong>S</strong> and holidays as <strong>H</strong>. They are not counted against anyone&apos;s percentage.</p>
        </div>

        {error && <div className="t-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
        {loading && !data && <div className="skeleton" style={{ height: 240 }} />}
        {msg && <p className={msg.type === "success" ? "success-text" : "error-text"} role="status">{msg.text}</p>}
      </div>

      {data && students.length === 0 && <div className="portal-panel no-print"><div className="t-empty">No students found.</div></div>}

      {data && students.length > 0 && (
        <div className="print-sheet ar-sheet">
          <div className="ar-head">
            <div className="ar-school">{SCHOOL}</div>
            <div className="ar-title">{title}</div>
            <div className="ar-sub">{workingDays} working days · {sundays} Sundays · {holidayDays.length} holiday{holidayDays.length === 1 ? "" : "s"}</div>
          </div>

          {monthTables.map((m) => (
            <div className="ar-month" key={m.key}>
              <div className="ar-month-title">{m.label}</div>
              <div style={{ overflowX: "auto" }}>
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Roll</th>
                      <th rowSpan={2} className="ar-name">Name</th>
                      {m.days.map((d) => <th key={d.date} className={d.kind === "sunday" ? "ar-sun" : d.kind === "holiday" ? "ar-hol" : ""}>{dayNumber(d.date)}</th>)}
                      <th colSpan={4}>Total</th>
                    </tr>
                    <tr>
                      {m.days.map((d) => <th key={d.date} className={d.kind === "sunday" ? "ar-sun" : d.kind === "holiday" ? "ar-hol" : ""}>{weekdayOf(d.date)}</th>)}
                      <th>P</th><th>Lt</th><th>A</th><th>Lv</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const rec = data.records[s.id];
                      const t = totalsFor(m.days, rec);
                      return (
                        <tr key={s.id}>
                          <td>{s.roll_no}</td>
                          <td className="ar-name">{s.full_name}</td>
                          {m.days.map((d) => <td key={d.date} className={cellClass(d, rec)}>{cellOf(d, rec)}</td>)}
                          <td>{t.present}</td><td>{t.late}</td><td>{t.absent}</td><td>{t.leave}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="ar-month">
            <div className="ar-month-title">Summary for the whole period ({rangeText})</div>
            <div style={{ overflowX: "auto" }}>
              <table className="ar-table ar-summary">
                <thead><tr><th>Roll</th><th className="ar-name">Name</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th><th>Not marked</th><th>Attendance %</th></tr></thead>
                <tbody>
                  {students.map((s) => {
                    const t = totalsFor(days, data.records[s.id]);
                    const low = t.pct !== null && t.marked >= 5 && t.pct < threshold;
                    return (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td className="ar-name">{s.full_name}</td>
                        <td>{t.present}</td><td>{t.late}</td><td>{t.absent}</td><td>{t.leave}</td><td>{t.notMarked}</td>
                        <td className={low ? "ar-low" : ""}><strong>{t.pct === null ? "—" : `${t.pct}%`}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="ar-legend">
              <strong>Key:</strong> P = Present · Lt = Late (counted as present) · A = Absent · Lv = Leave · S = Sunday · H = Holiday · blank = not marked. Percentages below {threshold}% are marked in red.
              {reasonList.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <strong>Holidays:</strong> {reasonList.map(([d, r]) => `${formatDate(d)} — ${r}`).join("; ")}
                </div>
              )}
            </div>
          </div>

          <div className="ar-sign">
            <div><span />Class Teacher</div>
            <div><span />Principal / Head Master</div>
          </div>
          <div className="ar-printed">Printed on {formatDate(today)}</div>
        </div>
      )}

      {data && single && (
        <div className="portal-panel no-print">
          <h2>Day by day — {single.full_name}</h2>
          {canEdit && (
            <div className="form-field" style={{ maxWidth: 460 }}>
              <label htmlFor="ar_reason">Reason if you change a day (optional, saved in the Activity Log)</label>
              <input id="ar_reason" value={editReason} onChange={(e) => setEditReason(e.target.value)} placeholder="e.g. Marked absent by mistake" />
            </div>
          )}
          <div style={{ overflowX: "auto", maxHeight: 460, overflowY: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Day</th><th>Attendance</th><th>Note</th></tr></thead>
              <tbody>
                {days.filter((d) => d.kind !== "future").map((d) => {
                  const s = data.records[single.id]?.[d.date] || "";
                  return (
                    <tr key={d.date}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDate(d.date)}</td>
                      <td>{weekdayLong(d.date)}</td>
                      <td>
                        {d.kind === "sunday" ? <span className="pill pill-gray">Sunday</span>
                          : d.kind === "holiday" ? <span className="pill pill-amber">Holiday</span>
                          : canEdit ? (
                            <select value={s} onChange={(e) => e.target.value && changeDay(d.date, e.target.value)} style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid var(--border)" }}>
                              <option value="">Not marked</option>
                              {["present", "late", "absent", "leave"].map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                            </select>
                          ) : s ? <span className={`pill ${s === "present" ? "pill-green" : s === "absent" ? "pill-red" : s === "late" ? "pill-amber" : "pill-gray"}`}>{STATUS_LABEL[s]}</span>
                          : <span className="t-test-meta">Not marked</span>}
                      </td>
                      <td>{d.kind === "holiday" ? d.reason : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
