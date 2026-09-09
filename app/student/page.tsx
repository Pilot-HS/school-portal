"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function StudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

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

      if (!profile || profile.role !== "student") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const { data: studentRow } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("profile_id", session.user.id)
        .single();
      setStudent(studentRow);

      if (studentRow) {
        const [{ data: att }, { data: asg }, { data: res }, { data: fee }] = await Promise.all([
          supabase.from("attendance").select("*").eq("student_id", studentRow.id).order("date", { ascending: false }).limit(10),
          supabase.from("assignments").select("*").eq("class_id", studentRow.class_id).order("due_date", { ascending: true }),
          supabase.from("exam_results").select("*").eq("student_id", studentRow.id),
          supabase.from("fees").select("*").eq("student_id", studentRow.id),
        ]);
        setAttendance(att || []);
        setAssignments(asg || []);
        setResults(res || []);
        setFees(fee || []);
      }

      const { data: noticesData } = await supabase
        .from("notices")
        .select("*")
        .in("audience", ["all", "students"])
        .order("created_at", { ascending: false })
        .limit(5);
      setNotices(noticesData || []);

      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="student" fullName={fullName} />
      <div className="portal-main">
        {!student ? (
          <div className="portal-panel">
            <h2>No student record linked yet</h2>
            <p>Your login works, but the school admin hasn't linked your account to a student record yet. Ask the office to complete this step.</p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: "1.5rem" }}>Welcome, {student.full_name}</h1>
            <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
              {student.classes?.name || "No class assigned"} &middot; Roll No. {student.roll_no}
            </p>

            <div className="portal-cards">
              <div className="portal-stat-card"><div className="ps-num">{attendance.length}</div><div className="ps-label">Recent attendance records</div></div>
              <div className="portal-stat-card"><div className="ps-num">{assignments.length}</div><div className="ps-label">Assignments for your class</div></div>
              <div className="portal-stat-card"><div className="ps-num">{results.length}</div><div className="ps-label">Recorded exam results</div></div>
              <div className="portal-stat-card"><div className="ps-num">{fees.filter((f) => f.status === "unpaid").length}</div><div className="ps-label">Unpaid charges</div></div>
            </div>

            <div className="portal-panel">
              <h2>Recent Attendance</h2>
              {attendance.length === 0 ? <p>No attendance records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td><span className={`pill ${a.status === "present" ? "pill-green" : a.status === "leave" ? "pill-amber" : "pill-red"}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="portal-panel">
              <h2>Assignments</h2>
              {assignments.length === 0 ? <p>No assignments recorded yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Title</th><th>Due</th></tr></thead>
                  <tbody>
                    {assignments.map((a) => (
                      <tr key={a.id}><td>{a.subject}</td><td>{a.title}</td><td>{a.due_date}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="portal-panel">
              <h2>Exam Results</h2>
              {results.length === 0 ? <p>No results recorded yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Exam</th><th>Marks</th></tr></thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}><td>{r.subject}</td><td>{r.exam_name}</td><td>{r.marks_obtained} / {r.total_marks}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="portal-panel">
              <h2>Fees</h2>
              {fees.length === 0 ? <p>No fee records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Charge</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.id}><td>{f.charge_name}</td><td>PKR {f.amount}</td><td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div className="portal-panel">
          <h2>Notices</h2>
          {notices.length === 0 ? <p>No notices posted yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Notice</th></tr></thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}><td>{new Date(n.created_at).toLocaleDateString()}</td><td>{n.title}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
