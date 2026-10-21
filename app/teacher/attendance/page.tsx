"use client";

import { useCallback, useState } from "react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import AttendanceMarker from "@/components/AttendanceMarker";
import AttendanceRegister from "@/components/AttendanceRegister";
import HolidayManager from "@/components/HolidayManager";
import { addDays } from "@/lib/attendanceStats";
import { localISODate, formatDate } from "@/lib/teacherUi";

type Tab = "mark" | "history" | "register" | "holidays";

export default function AttendancePage() {
  const { role, classes, myClassIds } = useTeacher();
  const isAdmin = role === "admin";
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [date, setDate] = useState(localISODate());
  const [tab, setTab] = useState<Tab>("mark");
  const [history, setHistory] = useState<any[]>([]);
  const [lockDays, setLockDays] = useState(0);

  const onLoaded = useCallback((d: any) => {
    setHistory(d.history || []);
    setLockDays(d.lock_days || 0);
  }, []);

  const today = localISODate();
  const minDate = !isAdmin && lockDays > 0 ? addDays(today, -lockDays) : undefined;

  return (
    <div className="portal-main">
      <h1 className="t-page-title no-print">Attendance</h1>

      <div className="t-segment no-print" role="tablist">
        <button className={tab === "mark" ? "active" : ""} onClick={() => setTab("mark")}>Mark</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Last 14 days</button>
        <button className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Register &amp; print</button>
        <button className={tab === "holidays" ? "active" : ""} onClick={() => setTab("holidays")}>Holidays</button>
      </div>

      {(tab === "mark" || tab === "history") && (
        <div className="portal-panel no-print">
          <div className="t-form-row">
            <div className="form-field">
              <label htmlFor="class_id">Class</label>
              <ClassSelect id="class_id" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
            </div>
            {tab === "mark" && (
              <div className="form-field">
                <label htmlFor="date">Date</label>
                <input id="date" type="date" min={minDate} max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </div>
            )}
          </div>
          {tab === "mark" && minDate && <p className="t-hint" style={{ margin: 0 }}>You can mark or change attendance back to {formatDate(minDate)}.</p>}
        </div>
      )}

      {/* Kept mounted so the 14-day summary stays in step with the selected class */}
      <div style={{ display: tab === "mark" ? "block" : "none" }} className="no-print">
        {!classId ? (
          <div className="portal-panel"><div className="t-empty">{classes.length === 0 ? "No classes are assigned to you yet. Ask the admin to add your timetable." : "Choose a class to begin."}</div></div>
        ) : (
          <AttendanceMarker classId={classId} date={date} isAdmin={isAdmin} onLoaded={onLoaded} />
        )}
      </div>

      {tab === "history" && (
        <div className="portal-panel no-print">
          <h2>Daily summary</h2>
          {history.length === 0 ? (
            <div className="t-empty">No attendance has been marked for this class in the last 30 days.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Present</th><th>Late</th><th>Absent</th><th>Leave</th><th></th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date}>
                      <td>{formatDate(h.date)}</td>
                      <td><span className="pill pill-green">{h.present}</span></td>
                      <td><span className="pill pill-amber">{h.late || 0}</span></td>
                      <td><span className="pill pill-red">{h.absent}</span></td>
                      <td><span className="pill pill-gray">{h.leave}</span></td>
                      <td>
                        <button className="auth-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setDate(h.date); setTab("mark"); }}>Open</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "register" && <AttendanceRegister mode="class" classes={classes} myClassIds={myClassIds} defaultClassId={classId} canEdit={isAdmin} />}

      {tab === "holidays" && (
        <div className="no-print">
          <HolidayManager classes={classes} myClassIds={myClassIds} isAdmin={isAdmin} defaultClassId={classId} />
        </div>
      )}
    </div>
  );
}
