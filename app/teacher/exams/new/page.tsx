"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function EnterResultsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [examName, setExamName] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [term, setTerm] = useState("Term 1");
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
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
    if (!classId) {
      setStudents([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", classId).order("roll_no");
      setStudents(data || []);
      setMarks({});
    })();
  }, [classId]);

  function setMark(studentId: string, value: string) {
    setMarks((prev) => ({ ...prev, [studentId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const records = students
      .filter((s) => marks[s.id] !== undefined && marks[s.id] !== "")
      .map((s) => ({ student_id: s.id, marks_obtained: Number(marks[s.id]) }));

    if (records.length === 0) {
      setMessage({ type: "error", text: "Enter at least one student's marks." });
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/teacher/enter-results", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        subject,
        exam_name: examName,
        total_marks: Number(totalMarks),
        term,
        records,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Results saved for ${result.count} students.` });
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="teacher" fullName={fullName} />
      <div className="portal-main">
        <Link href="/teacher" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Dashboard</Link>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Enter Exam Results</h1>

        <div className="portal-panel" style={{ maxWidth: "600px" }}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="class_id">Class</label>
              <select id="class_id" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class&hellip;</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="subject">Subject</label>
              <input id="subject" placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="exam_name">Exam name</label>
              <input id="exam_name" placeholder="e.g. Term 1 Test" value={examName} onChange={(e) => setExamName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="total_marks">Total marks</label>
              <input id="total_marks" type="number" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="term">Term</label>
              <input id="term" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>
          </div>
        </div>

        {classId && (
          <form onSubmit={handleSubmit}>
            <div className="portal-panel">
              <h2>Marks</h2>
              {students.length === 0 ? (
                <p>No students in this class yet.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Roll No.</th><th>Name</th><th>Marks Obtained</th></tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td>{s.full_name}</td>
                        <td>
                          <input
                            type="number"
                            style={{ width: "90px", padding: "6px 10px" }}
                            value={marks[s.id] || ""}
                            onChange={(e) => setMark(s.id, e.target.value)}
                            max={Number(totalMarks)}
                            min={0}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {students.length > 0 && (
                <button type="submit" className="btn btn-primary" style={{ marginTop: "16px" }} disabled={submitting || !subject || !examName}>
                  {submitting ? "Saving…" : "Save Results"}
                </button>
              )}
              {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
