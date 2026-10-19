"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import { teacherApi } from "@/lib/teacherApi";
import { formatDate, localISODate } from "@/lib/teacherUi";

function dayCount(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

export default function LeavePage() {
  const { teacher } = useTeacher();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [start, setStart] = useState(localISODate());
  const [end, setEnd] = useState(localISODate());
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await teacherApi("/api/teacher/leave-requests");
    if (!ok) setLoadError(data.error || "Could not load your leave requests.");
    else setRequests(data.requests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/submit-leave-request", {
      body: { start_date: start, end_date: end, reason },
    });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Something went wrong. Please try again." });
    } else {
      setMessage({ type: "success", text: "Leave request sent to the admin." });
      setReason("");
      await load();
    }
    setSubmitting(false);
  }

  return (
    <div className="portal-main">
      <h1 className="t-page-title">Leave</h1>

      <div className="portal-panel" style={{ maxWidth: 560 }}>
        <h2>Apply for leave</h2>
        {!teacher && (
          <p className="error-text" style={{ marginTop: 0 }}>
            Your login isn&apos;t linked to a teacher record yet. Ask the admin to link it before applying.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="t-form-row">
            <div className="form-field">
              <label htmlFor="start">From</label>
              <input id="start" type="date" required value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
            </div>
            <div className="form-field">
              <label htmlFor="end">To</label>
              <input id="end" type="date" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="reason">Reason</label>
            <textarea id="reason" className="t-textarea" rows={3} placeholder="Briefly explain why you need leave" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="t-hint" style={{ marginTop: -6 }}>{dayCount(start, end)} {dayCount(start, end) === 1 ? "day" : "days"} requested</p>
          <button type="submit" className="btn btn-primary" disabled={submitting || !teacher}>
            {submitting ? "Sending…" : "Send request"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>My requests</h2>
        {loadError && <div className="t-error" role="alert"><span>{loadError}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
        {loading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : requests.length === 0 ? (
          <div className="t-empty"><CalendarOff size={28} />You haven&apos;t requested any leave yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.start_date)}{r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}</td>
                    <td>{dayCount(r.start_date, r.end_date)}</td>
                    <td>{r.reason || "—"}</td>
                    <td>
                      <span className={`pill ${r.status === "approved" ? "pill-green" : r.status === "rejected" ? "pill-red" : "pill-amber"}`}>
                        {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
