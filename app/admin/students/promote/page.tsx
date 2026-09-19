"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function PromoteStudentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ promoted: string[]; skipped: { name: string; reason: string }[] } | null>(null);

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

      const { data: classData } = await supabase.from("classes").select("*").order("grade");
      setClasses(classData || []);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!fromClassId) {
      setStudents([]);
      setSelected(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", fromClassId).order("roll_no");
      setStudents(data || []);
      setSelected(new Set((data || []).map((s) => s.id))); // select all by default
    })();
  }, [fromClassId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePromote() {
    setSubmitting(true);
    setResult(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/promote-students", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_ids: Array.from(selected), new_class_id: toClassId }),
    });
    const data = await res.json();

    if (res.ok) {
      setResult({ promoted: data.promoted, skipped: data.skipped });
      const { data: refreshed } = await supabase.from("students").select("*").eq("class_id", fromClassId).order("roll_no");
      setStudents(refreshed || []);
      setSelected(new Set());
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Promote Students</h1>

      <div className="portal-panel" style={{ maxWidth: "600px" }}>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="from_class">From class</label>
            <select id="from_class" value={fromClassId} onChange={(e) => setFromClassId(e.target.value)}>
              <option value="">Select&hellip;</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="to_class">To class</label>
            <select id="to_class" value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
              <option value="">Select&hellip;</option>
              {classes.filter((c) => c.id !== fromClassId).map((c) => <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>)}
            </select>
          </div>
        </div>
      </div>

      {fromClassId && (
        <div className="portal-panel">
          <h2>Select Students to Promote</h2>
          {students.length === 0 ? <p>No students in this class.</p> : (
            <table className="data-table">
              <thead><tr><th></th><th>Roll No.</th><th>Name</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} /></td>
                    <td>{s.roll_no}</td>
                    <td>{s.full_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button
            className="btn btn-primary mt-32"
            disabled={submitting || selected.size === 0 || !toClassId}
            onClick={handlePromote}
          >
            {submitting ? "Promoting…" : `Promote ${selected.size} Student${selected.size === 1 ? "" : "s"}`}
          </button>
          <p className="form-note" style={{ marginTop: "10px" }}>
            Students keep their existing roll number in the new class. If a roll number is already taken there, that student is skipped and listed below so you can adjust it manually.
          </p>

          {result && (
            <div className="mt-32">
              {result.promoted.length > 0 && (
                <p className="success-text">Promoted: {result.promoted.join(", ")}</p>
              )}
              {result.skipped.length > 0 && (
                <div>
                  <p className="error-text" style={{ marginBottom: "6px" }}>Skipped:</p>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {result.skipped.map((s, i) => (
                      <li key={i} style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{s.name} &mdash; {s.reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
