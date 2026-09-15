"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7];

export default function TimetablePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [entries, setEntries] = useState<any[]>([]);

  const [day, setDay] = useState("Monday");
  const [period, setPeriod] = useState("1");
  const [subject, setSubject] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadEntries(cid: string) {
    const { data } = await supabase
      .from("timetable_entries")
      .select("*, teachers(full_name)")
      .eq("class_id", cid);
    setEntries(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const [{ data: classData }, { data: teacherData }] = await Promise.all([
        supabase.from("classes").select("*").order("grade"),
        supabase.from("teachers").select("*").order("full_name"),
      ]);
      setClasses(classData || []);
      setTeachers(teacherData || []);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (classId) loadEntries(classId);
    else setEntries([]);
  }, [classId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-timetable-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        class_id: classId,
        day_of_week: day,
        period_number: Number(period),
        subject,
        teacher_id: teacherId || null,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Period added." });
      setSubject("");
      setTeacherId("");
      await loadEntries(classId);
    }
    setSubmitting(false);
  }

  async function handleDelete(entryId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/delete-timetable-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ entry_id: entryId }),
    });

    await loadEntries(classId);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  function findEntry(d: string, p: number) {
    return entries.find((e) => e.day_of_week === d && e.period_number === p);
  }

  return (
    <AdminLayout active="timetable" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }}>Timetable</h1>

      <div className="portal-panel" style={{ maxWidth: "320px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="class_id">Choose a class</label>
          <select id="class_id" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class&hellip;</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
            ))}
          </select>
        </div>
      </div>

      {classId && (
        <>
          <div className="portal-panel" style={{ overflowX: "auto" }}>
            <h2>Weekly Grid</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  {DAYS.map((d) => <th key={d}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((p) => (
                  <tr key={p}>
                    <td>{p}</td>
                    {DAYS.map((d) => {
                      const entry = findEntry(d, p);
                      return (
                        <td key={d} style={{ minWidth: "110px" }}>
                          {entry ? (
                            <div>
                              <div style={{ fontWeight: 600 }}>{entry.subject}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{entry.teachers?.full_name || ""}</div>
                              <button
                                onClick={() => handleDelete(entry.id)}
                                style={{ fontSize: "0.72rem", color: "#a13636", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: "4px" }}
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "var(--border)" }}>&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="portal-panel" style={{ maxWidth: "520px" }}>
            <h2>Add a Period</h2>
            <form onSubmit={handleAdd}>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="day">Day</label>
                  <select id="day" value={day} onChange={(e) => setDay(e.target.value)}>
                    {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="period">Period</label>
                  <select id="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
                    {PERIODS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="subject">Subject</label>
                  <input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="teacher_id">Teacher (optional)</label>
                  <select id="teacher_id" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                    <option value="">Unassigned</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Adding…" : "Add Period"}
              </button>
              {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
            </form>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
