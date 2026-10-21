"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X, Clock3, CalendarOff, CheckCheck, Lock, Sun } from "lucide-react";
import { teacherApi } from "@/lib/teacherApi";
import { addDays, Status } from "@/lib/attendanceStats";
import { formatDate } from "@/lib/teacherUi";

// Marks (or, for the admin, edits) one class's attendance for one date.
export default function AttendanceMarker({
  classId,
  date,
  isAdmin = false,
  readOnly = false,
  onLoaded,
  onSaved,
}: {
  classId: string;
  date: string;
  isAdmin?: boolean;
  readOnly?: boolean;
  onLoaded?: (data: any) => void;
  onSaved?: () => void;
}) {
  const [students, setStudents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [alreadyMarked, setAlreadyMarked] = useState(false);
  const [info, setInfo] = useState<{ today: string; lock_days: number; is_sunday: boolean; holiday: string | null }>({ today: "", lock_days: 0, is_sunday: false, holiday: null });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const counter = useRef(0);

  const load = useCallback(async () => {
    if (!classId || !date) return;
    const mine = ++counter.current;
    setLoading(true);
    const { ok, data } = await teacherApi(`/api/teacher/attendance-data?class_id=${classId}&date=${date}`);
    if (mine !== counter.current) return;
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
    setAlreadyMarked(Object.keys(records).length > 0);
    setInfo({ today: data.today || "", lock_days: data.lock_days || 0, is_sunday: !!data.is_sunday, holiday: data.holiday || null });
    onLoaded?.(data);
    setLoading(false);
  }, [classId, date, onLoaded]);

  useEffect(() => {
    setStudents([]);
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  const future = !!info.today && date > info.today;
  const locked = !isAdmin && info.lock_days > 0 && !!info.today && date < addDays(info.today, -info.lock_days);
  const blocked = info.is_sunday || !!info.holiday || future || locked;

  function setAll(status: Status) {
    const next: Record<string, Status> = {};
    students.forEach((s) => (next[s.id] = status));
    setStatuses(next);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const records = students.map((s) => ({ student_id: s.id, status: statuses[s.id] || "present" }));
    const { ok, data } = await teacherApi("/api/teacher/mark-attendance", { body: { class_id: classId, date, records, reason: isAdmin ? reason : undefined } });
    if (!ok) setMessage({ type: "error", text: data.error || "Something went wrong. Please try again." });
    else {
      await load();
      setReason("");
      setMessage({ type: "success", text: `Attendance saved for ${data.count} students on ${formatDate(date)}.` });
      onSaved?.();
    }
    setSaving(false);
  }

  const counts: Record<Status, number> = { present: 0, late: 0, absent: 0, leave: 0 };
  students.forEach((s) => counts[statuses[s.id] || "present"]++);

  if (loading && students.length === 0) return <div className="skeleton" style={{ height: 240 }} />;
  if (students.length === 0) return <div className="portal-panel"><div className="t-empty">No students in this class yet.</div></div>;

  const buttons: { s: Status; icon: any; code: string; label: string }[] = [
    { s: "present", icon: Check, code: "P", label: "Present" },
    { s: "absent", icon: X, code: "A", label: "Absent" },
    { s: "late", icon: Clock3, code: "Lt", label: "Late" },
    { s: "leave", icon: CalendarOff, code: "Lv", label: "Leave" },
  ];

  return (
    <>
      {info.is_sunday && <div className="att-banner sun"><Sun size={18} /> {formatDate(date)} is a <strong>Sunday</strong>. There is no attendance to mark.</div>}
      {info.holiday && <div className="att-banner hol"><CalendarOff size={18} /> <span><strong>Holiday:</strong> {info.holiday}</span></div>}
      {future && <div className="att-banner hol">Attendance can&apos;t be marked for a future date.</div>}
      {locked && <div className="att-banner lock"><Lock size={18} /> Attendance older than {info.lock_days} days is locked. Ask the admin to change it.</div>}

      <div className="portal-panel" style={{ paddingBottom: 8 }}>
        <div className="t-row-between" style={{ flexWrap: "wrap", gap: 10 }}>
          <div>
            <h2 style={{ margin: 0 }}>{students.length} students</h2>
            {alreadyMarked && !blocked && <span className="pill pill-amber" style={{ marginTop: 6 }}>Already marked{readOnly ? "" : " — you are editing"}</span>}
            {!alreadyMarked && !blocked && readOnly && <span className="pill pill-gray" style={{ marginTop: 6 }}>Not marked yet</span>}
          </div>
          {!blocked && !readOnly && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setAll("present")}><CheckCheck size={15} /> All present</button>
              <button className="btn btn-outline" onClick={() => setAll("absent")}>All absent</button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 10 }}>
          {students.map((s) => {
            const st = statuses[s.id] || "present";
            return (
              <div className="att-row" key={s.id}>
                <div className="att-roll">{s.roll_no}</div>
                <div className="att-name">{s.full_name}</div>
                <div className="att-btns">
                  {buttons.map((b) => {
                    const Icon = b.icon;
                    const active = st === b.s;
                    return (
                      <button
                        key={b.s}
                        type="button"
                        aria-label={b.label}
                        disabled={blocked || readOnly}
                        className={`att-btn ${b.s} ${active ? "active" : ""}`}
                        onClick={() => setStatuses((p) => ({ ...p, [s.id]: b.s }))}
                      >
                        <Icon size={15} /> <span>{b.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!blocked && !readOnly && (
        <>
          {isAdmin && (
            <div className="form-field" style={{ maxWidth: 460 }}>
              <label htmlFor="att_reason">Reason for this change (optional, saved in the Activity Log)</label>
              <input id="att_reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Teacher marked the wrong student" />
            </div>
          )}
          <div className="att-bar">
            <div className="att-counts">
              <span className="pill pill-green">P {counts.present}</span>
              <span className="pill pill-red">A {counts.absent}</span>
              <span className="pill pill-amber">Lt {counts.late}</span>
              <span className="pill pill-gray">Lv {counts.leave}</span>
            </div>
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : alreadyMarked ? "Update Attendance" : "Save Attendance"}
            </button>
          </div>
        </>
      )}
      {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
    </>
  );
}
