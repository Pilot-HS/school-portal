"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function ExamsSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [exams, setExams] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadExams() {
    const { data } = await supabase.from("exams").select("*, academic_years(label)").order("created_at", { ascending: false });
    setExams(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") { router.replace(profile?.role ? `/${profile.role}` : "/login"); return; }
      setFullName(profile.full_name);

      const { data: years } = await supabase.from("academic_years").select("*").order("label", { ascending: false });
      setAcademicYears(years || []);
      const current = (years || []).find((y: any) => y.is_current);
      if (current) setAcademicYearId(current.id);

      await loadExams();
      setLoading(false);
    })();
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/create-exam", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, term, academic_year_id: academicYearId, start_date: startDate, end_date: endDate }),
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${name} scheduled.` });
      setName(""); setTerm(""); setStartDate(""); setEndDate("");
      await loadExams();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="exams" fullName={fullName}>
      <Link href="/admin/exams" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Exams &amp; Results</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Exam Scheduling</h1>

      <div className="portal-panel" style={{ maxWidth: "480px" }}>
        <h2>Schedule a New Exam</h2>
        <form onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="name">Exam name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Term 1 Test, Mid Term, Final Exam" />
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="term">Term</label>
              <input id="term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Term 1" />
            </div>
            <div className="form-field">
              <label htmlFor="academic_year_id">Academic year</label>
              <select id="academic_year_id" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}>
                <option value="">Select&hellip;</option>
                {academicYears.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? " (Current)" : ""}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="start_date">Start date</label>
              <input id="start_date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="end_date">End date</label>
              <input id="end_date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Scheduling…" : "Schedule Exam"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>Scheduled Exams</h2>
        {exams.length === 0 ? <p>No exams scheduled yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Term</th><th>Academic Year</th><th>Dates</th><th></th></tr></thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.term || "\u2014"}</td>
                  <td>{e.academic_years?.label || "\u2014"}</td>
                  <td>{e.start_date || "\u2014"} {e.end_date ? `\u2013 ${e.end_date}` : ""}</td>
                  <td><Link href={`/admin/exams-schedule/${e.id}`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>Manage Subjects</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
