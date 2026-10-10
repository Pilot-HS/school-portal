"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function ExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [exam, setExam] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState("100");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadAssignments() {
    const { data } = await supabase.from("exam_subjects").select("*, classes(name), subjects(name)").eq("exam_id", examId).order("created_at");
    setAssignments(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") { router.replace(profile?.role ? `/${profile.role}` : "/login"); return; }
      setFullName(profile.full_name);

      const [{ data: examRow }, { data: classData }, { data: subjectData }] = await Promise.all([
        supabase.from("exams").select("*").eq("id", examId).single(),
        supabase.from("classes").select("*").order("grade"),
        supabase.from("subjects").select("*").order("name"),
      ]);
      setExam(examRow);
      setClasses(classData || []);
      setSubjects(subjectData || []);
      await loadAssignments();
      setLoading(false);
    })();
  }, [router, examId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/add-exam-subject", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ exam_id: examId, class_id: classId, subject_id: subjectId, max_marks: maxMarks }),
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Subject assigned." });
      setSubjectId("");
      await loadAssignments();
    }
    setSubmitting(false);
  }

  async function handleRemove(examSubjectId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch("/api/admin/delete-exam-subject", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ exam_subject_id: examSubjectId }),
    });
    await loadAssignments();
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;
  if (!exam) return <AdminLayout active="exams" fullName={fullName}><p>Exam not found.</p></AdminLayout>;

  return (
    <AdminLayout active="exams" fullName={fullName}>
      <Link href="/admin/exams-schedule" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Exam Scheduling</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>{exam.name}</h1>

      <div className="portal-panel" style={{ maxWidth: "560px" }}>
        <h2>Assign a Subject</h2>
        <form onSubmit={handleAdd}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="class_id">Class</label>
              <select id="class_id" required value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select&hellip;</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="subject_id">Subject</label>
              <select id="subject_id" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">Select&hellip;</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="max_marks">Max marks</label>
              <input id="max_marks" type="number" required value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Adding…" : "Add"}</button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
        {subjects.length === 0 && (
          <p className="form-note mt-32" style={{ marginBottom: 0 }}>
            No subjects exist yet. <Link href="/admin/subjects" style={{ color: "var(--accent-2)" }}>Add subjects first</Link>.
          </p>
        )}
      </div>

      <div className="portal-panel">
        <h2>Subjects in This Exam</h2>
        {assignments.length === 0 ? <p>No subjects assigned yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Class</th><th>Subject</th><th>Max Marks</th><th></th></tr></thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.classes?.name}</td>
                  <td>{a.subjects?.name}</td>
                  <td>{a.max_marks}</td>
                  <td><button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem", color: "#a13636" }} onClick={() => handleRemove(a.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
