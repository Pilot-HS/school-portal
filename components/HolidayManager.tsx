"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Trash2 } from "lucide-react";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";
import { formatDate, localISODate } from "@/lib/teacherUi";

// List, add and remove holidays. The admin can mark the whole school; a teacher only their own classes.
export default function HolidayManager({ classes, myClassIds, isAdmin, defaultClassId = "" }: { classes: any[]; myClassIds: string[]; isAdmin: boolean; defaultClassId?: string }) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [from, setFrom] = useState(localISODate());
  const [to, setTo] = useState("");
  const [scope, setScope] = useState(isAdmin ? "" : defaultClassId || myClassIds[0] || "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await teacherApi("/api/attendance/holidays");
    if (!ok) {
      if (data.setup_needed) setSetupNeeded(true);
      else setMessage({ type: "error", text: data.error || "Could not load holidays." });
    } else {
      setSetupNeeded(false);
      setHolidays(data.holidays || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/attendance/holidays", { body: { from_date: from, to_date: to || from, reason, class_id: scope || null } });
    if (!ok) setMessage({ type: "error", text: data.error || "Could not save the holiday." });
    else {
      setMessage({ type: "success", text: `${data.count} day${data.count === 1 ? "" : "s"} marked as holiday.` });
      setReason("");
      setTo("");
      await load();
    }
    setBusy(false);
  }

  async function remove(h: any) {
    if (!window.confirm(`Remove the holiday on ${formatDate(h.holiday_date)}?`)) return;
    const { ok, data } = await teacherApi("/api/attendance/holidays", { method: "DELETE", body: { id: h.id } });
    if (!ok) setMessage({ type: "error", text: data.error || "Could not remove it." });
    else await load();
  }

  if (setupNeeded) {
    return (
      <div className="portal-panel">
        <h2>One-time setup needed</h2>
        <p style={{ marginTop: 0 }}>Run <strong>setup-database.sql</strong> once in Supabase (SQL Editor &rarr; New query &rarr; paste &rarr; Run), then reload this page.</p>
      </div>
    );
  }

  const today = localISODate();
  return (
    <>
      <form className="portal-panel" onSubmit={add} style={{ maxWidth: 640 }}>
        <h2>Mark a holiday</h2>
        <div className="t-form-grid">
          <div className="form-field">
            <label htmlFor="h_from">Date (or first day)</label>
            <input id="h_from" type="date" required value={from} onChange={(e) => { setFrom(e.target.value); if (to && e.target.value > to) setTo(e.target.value); }} />
          </div>
          <div className="form-field">
            <label htmlFor="h_to">Last day (optional)</label>
            <input id="h_to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="h_scope">Applies to</label>
            {isAdmin ? (
              <ClassSelect id="h_scope" value={scope} onChange={setScope} classes={classes} myClassIds={[]} placeholder="Whole school" />
            ) : (
              <ClassSelect id="h_scope" required value={scope} onChange={setScope} classes={classes} myClassIds={myClassIds} placeholder="Choose a class…" />
            )}
          </div>
          <div className="form-field">
            <label htmlFor="h_reason">Reason (shown on the register)</label>
            <input id="h_reason" required minLength={3} maxLength={150} placeholder="e.g. Independence Day" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Mark as holiday"}</button>
        <p className="t-hint">Sundays are already marked automatically. {isAdmin ? "" : "You can mark holidays for your own classes. The admin marks whole-school holidays."}</p>
        {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
      </form>

      <div className="portal-panel">
        <h2>Holidays</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : holidays.length === 0 ? (
          <div className="t-empty"><CalendarOff size={28} />No holidays marked yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Reason</th><th>Applies to</th><th></th></tr></thead>
              <tbody>
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDate(h.holiday_date)} {h.holiday_date >= today && <span className="pill pill-amber">Upcoming</span>}</td>
                    <td>{h.reason}</td>
                    <td>{h.scope}</td>
                    <td>{h.can_delete && <button className="t-icon-btn danger" onClick={() => remove(h)} aria-label="Remove holiday"><Trash2 size={16} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
