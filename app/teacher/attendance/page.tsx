"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

const today = () => new Date().toISOString().slice(0, 10);

export default function MarkAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
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
      const defaults: Record<string, string> = {};
      (data || []).forEach((s: any) => {
        defaults[s.id] = "present";
      });
      setStatuses(defaults);
    })();
  }, [classId]);

  function setStatus(studentId: string, status: string) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const records = students.map((s) => ({ student_id: s.id, status: statuses[s.id] || "present" }));

    const res = await fetch("/api/teacher/mark-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ class_id: classId, date, records }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Attendance saved for ${result.count} students on ${date}.` });
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="teacher" fullName={fullName} />
      <div className="portal-main">
        <Link href="/teacher" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Dashboard</Link>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Mark Attendance</h1>

        <div className="portal-panel" style={{ maxWidth: "560px" }}>
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
              <label htmlFor="date">Date</label>
              <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        {classId && (
          <form onSubmit={handleSubmit}>
            <div className="portal-panel">
              <h2>Students</h2>
              {students.length === 0 ? (
                <p>No students in this class yet.</p>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Roll No.</th><th>Name</th><th>Status</th></tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td>{s.roll_no}</td>
                        <td>{s.full_name}</td>
                        <td>
                          <select value={statuses[s.id] || "present"} onChange={(e) => setStatus(s.id, e.target.value)} style={{ width: "auto", padding: "6px 10px" }}>
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="leave">Leave</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {students.length > 0 && (
                <button type="submit" className="btn btn-primary" style={{ marginTop: "16px" }} disabled={submitting}>
                  {submitting ? "Saving…" : "Save Attendance"}
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
