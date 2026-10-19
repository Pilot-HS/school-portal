"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X, Clock3, CheckCheck } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";
import { localISODate, formatDate } from "@/lib/teacherUi";

type Status = "present" | "absent" | "leave";

export default function AttendancePage() {
  const { classes, myClassIds } = useTeacher();
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [date, setDate] = useState(localISODate());
  const [tab, setTab] = useState<"mark" | "history">("mark");
  const [students, setStudents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const requestCounter = useRef(0);

  const load = useCallback(async () => {
    if (!classId || !date) return;
    const myRequest = ++requestCounter.current;
    setLoading(true);
    const { ok, data } = await teacherApi(`/api/teacher/attendance-data?class_id=${classId}&date=${date}`);
    if (myRequest !== requestCounter.current) return; // a newer request replaced this one
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not load this class." });
      setLoading(false);
      return;
    }
    const list = data.students || [];
    const records = data.records || {};
    const next: Record<string, Status> = {};
    list.forEach((s: any) => {
      next[s.id] = (records[s.id] as Status) || "present";
    });
    setStudents(list);
    setStatuses(next);
    setHistory(data.history || []);
    setAlreadyMarked(Object.keys(records).length > 0);
    setLoading(false);
  }, [classId, date]);

  useEffect(() => {
    setStudents([]);
    setMessage(null);
    load();
  }, [load]);

  function setAll(status: Status) {
    const next: Record<string, Status> = {};
    students.forEach((s) => {
      next[s.id] = status;
    });
    setStatuses(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const records = students.map((s) => ({ student_id: s.id, status: statuses[s.id] || "present" }));
    const { ok, data } = await teacherApi("/api/teacher/mark-attendance", {
      body: { class_id: classId, date, records },
    });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Something went wrong. Please try again." });
    } else {
      await load();
      setMessage({ type: "success", text: `Attendance saved for ${data.count} students on ${formatDate(date)}.` });
    }
    setSaving(false);
  }

  const counts = { present: 0, absent: 0, leave: 0 };
  students.forEach((s) => {
    counts[statuses[s.id] || "present"]++;
  });

  return (
    <div className="portal-main">
      <h1 className="t-page-title">Attendance</h1>

      <div className="t-segment" role="tablist">
        <button className={tab === "mark" ? "active" : ""} onClick={() => setTab("mark")}>Mark</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Last 14 days</button>
      </div>

      <div className="portal-panel">
        <div className="t-form-row">
          <div className="form-field">
            <label htmlFor="class_id">Class</label>
            <ClassSelect id="class_id" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
          </div>
          {tab === "mark" && (
            <div className="form-field">
              <label htmlFor="date">Date</label>
              <input id="date" type="date" max={localISODate()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {!classId ? (
        <div className="portal-panel"><div className="t-empty">Choose a class to begin.</div></div>
      ) : loading && students.length === 0 ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : tab === "history" ? (
        <div className="portal-panel">
          <h2>Daily summary</h2>
          {history.length === 0 ? (
            <div className="t-empty">No attendance has been marked for this class in the last 30 days.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Date</th><th>Present</th><th>Absent</th><th>Leave</th><th></th></tr></thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date}>
                      <td>{formatDate(h.date)}</td>
                      <td><span className="pill pill-green">{h.present}</span></td>
                      <td><span className="pill pill-red">{h.absent}</span></td>
                      <td><span className="pill pill-amber">{h.leave}</span></td>
                      <td>
                        <button className="auth-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => { setDate(h.date); setTab("mark"); }}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : students.length === 0 ? (
        <div className="portal-panel"><div className="t-empty">No students in this class yet.</div></div>
      ) : (
        <>
          <div className="portal-panel" style={{ paddingBottom: 8 }}>
            <div className="t-row-between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <h2 style={{ margin: 0 }}>{students.length} students</h2>
                {alreadyMarked && <span className="pill pill-amber" style={{ marginTop: 6 }}>Already marked — you are editing</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-outline" onClick={() => setAll("present")}><CheckCheck size={15} /> All present</button>
                <button className="btn btn-outline" onClick={() => setAll("absent")}>All absent</button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              {students.map((s) => {
                const st = statuses[s.id] || "present";
                return (
                  <div className="att-row" key={s.id}>
                    <div className="att-roll">{s.roll_no}</div>
                    <div className="att-name">{s.full_name}</div>
                    <div className="att-btns">
                      <button type="button" aria-label="Present" className={`att-btn present ${st === "present" ? "active" : ""}`} onClick={() => setStatuses((p) => ({ ...p, [s.id]: "present" }))}>
                        <Check size={16} /> <span>P</span>
                      </button>
                      <button type="button" aria-label="Absent" className={`att-btn absent ${st === "absent" ? "active" : ""}`} onClick={() => setStatuses((p) => ({ ...p, [s.id]: "absent" }))}>
                        <X size={16} /> <span>A</span>
                      </button>
                      <button type="button" aria-label="Leave" className={`att-btn leave ${st === "leave" ? "active" : ""}`} onClick={() => setStatuses((p) => ({ ...p, [s.id]: "leave" }))}>
                        <Clock3 size={16} /> <span>L</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="att-bar">
            <div className="att-counts">
              <span className="pill pill-green">P {counts.present}</span>
              <span className="pill pill-red">A {counts.absent}</span>
              <span className="pill pill-amber">L {counts.leave}</span>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : alreadyMarked ? "Update Attendance" : "Save Attendance"}
            </button>
          </div>
        </>
      )}
      {message && (
        <p className={message.type === "success" ? "success-text" : "error-text"} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
