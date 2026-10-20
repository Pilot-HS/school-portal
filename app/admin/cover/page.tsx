"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { formatDate, localISODate } from "@/lib/teacherUi";

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

export default function CoverPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [cover, setCover] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [classId, setClassId] = useState("");
  const [start, setStart] = useState(localISODate());
  const [end, setEnd] = useState(localISODate());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { ok, json } = await api("/api/admin/cover");
    if (!ok) {
      if (json.setup_needed) setSetupNeeded(true);
      else setMessage({ type: "error", text: json.error || "Could not load cover." });
      return;
    }
    setCover(json.cover || []);
    setTeachers(json.teachers || []);
    setClasses(json.classes || []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      await load();
      setReady(true);
    })();
  }, [router, load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { ok, json } = await api("/api/admin/cover", "POST", { teacher_id: teacherId, class_id: classId, start_date: start, end_date: end, note });
    if (!ok) setMessage({ type: "error", text: json.error || "Could not save." });
    else {
      setMessage({ type: "success", text: "Cover added. The teacher can use that class on those dates." });
      setNote("");
      await load();
    }
    setBusy(false);
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this cover?")) return;
    const { ok, json } = await api("/api/admin/cover", "DELETE", { id });
    if (!ok) setMessage({ type: "error", text: json.error || "Could not remove." });
    else await load();
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  const today = localISODate();
  const status = (c: any) => (c.end_date < today ? "Ended" : c.start_date > today ? "Upcoming" : "Active");

  return (
    <AdminLayout active="cover" fullName={fullName}>
      <h1 className="t-page-title">Substitute Cover</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: -6 }}>
        Teachers can only take attendance, enter marks and post homework for classes in their own timetable.
        If a teacher is covering another class for a day or a few days, give them cover here.
      </p>

      {setupNeeded ? (
        <div className="portal-panel">
          <h2>One-time setup needed</h2>
          <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: "0.9rem" }}>
            <li>Open your project in <strong>Supabase</strong> → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
            <li>Copy everything from the file <strong>database/cover-setup.sql</strong>, paste it in and press <strong>Run</strong>.</li>
            <li>Reload this page.</li>
          </ol>
        </div>
      ) : (
        <>
          <form className="portal-panel" onSubmit={add} style={{ maxWidth: 620 }}>
            <h2>Give a teacher cover</h2>
            <div className="t-form-grid">
              <div className="form-field">
                <label htmlFor="c_teacher">Teacher</label>
                <select id="c_teacher" required value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  <option value="">Select…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="c_class">Class</label>
                <select id="c_class" required value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Select…</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="c_start">From</label>
                <input id="c_start" type="date" required value={start} onChange={(e) => { setStart(e.target.value); if (e.target.value > end) setEnd(e.target.value); }} />
              </div>
              <div className="form-field">
                <label htmlFor="c_end">To</label>
                <input id="c_end" type="date" required min={start} value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div className="form-field">
              <label htmlFor="c_note">Note (optional)</label>
              <input id="c_note" placeholder="e.g. Covering for Mr. Ahmed (leave)" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Add cover"}</button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
          </form>

          <div className="portal-panel">
            <h2>Cover list</h2>
            {cover.length === 0 ? (
              <div className="t-empty"><UserCheck size={28} />No cover set up yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Teacher</th><th>Class</th><th>Dates</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {cover.map((c) => {
                      const st = status(c);
                      return (
                        <tr key={c.id}>
                          <td>{c.teacher_name}{c.note ? <div className="t-test-meta">{c.note}</div> : null}</td>
                          <td>{c.class_name}</td>
                          <td>{formatDate(c.start_date)}{c.end_date !== c.start_date ? ` – ${formatDate(c.end_date)}` : ""}</td>
                          <td><span className={`pill ${st === "Active" ? "pill-green" : st === "Upcoming" ? "pill-amber" : "pill-gray"}`}>{st}</span></td>
                          <td><button className="t-icon-btn danger" onClick={() => remove(c.id)} aria-label="Remove cover"><Trash2 size={16} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
