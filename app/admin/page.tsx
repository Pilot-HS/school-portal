"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
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

      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const [{ data: studentData }, { data: teacherData }, { data: feeData }, { data: noticeData }] = await Promise.all([
        supabase.from("students").select("*, classes(name)").order("full_name"),
        supabase.from("teachers").select("*"),
        supabase.from("fees").select("*, students(full_name)"),
        supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setStudents(studentData || []);
      setTeachers(teacherData || []);
      setFees(feeData || []);
      setNotices(noticeData || []);

      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const unpaidCount = fees.filter((f) => f.status === "unpaid").length;

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="portal-main">
        <h1 style={{ fontSize: "1.5rem" }}>Admin Dashboard</h1>
        <p style={{ color: "var(--muted)", marginBottom: "24px" }}>Government Boys High School, P.H. Pilot, Dadu</p>

        <div className="portal-cards">
          <div className="portal-stat-card"><div className="ps-num">{students.length}</div><div className="ps-label">Total students</div></div>
          <div className="portal-stat-card"><div className="ps-num">{teachers.length}</div><div className="ps-label">Teachers &amp; staff</div></div>
          <div className="portal-stat-card"><div className="ps-num">{unpaidCount}</div><div className="ps-label">Unpaid fee records</div></div>
          <div className="portal-stat-card"><div className="ps-num">{notices.length}</div><div className="ps-label">Recent notices</div></div>
        </div>

        <div className="portal-panel">
          <h2>Manage Accounts</h2>
          <p>Create login accounts for new students, parents, and teachers.</p>
          <Link href="/admin/create-user" className="btn btn-primary">Create New Account</Link>
        </div>

        <div className="portal-panel">
          <h2>Manage Classes, Students &amp; Teachers</h2>
          <p>Add classes, then add student and teacher records — and link them to logins you've already created.</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link href="/admin/classes" className="btn btn-outline">Manage Classes</Link>
            <Link href="/admin/students/new" className="btn btn-outline">Add Student</Link>
            <Link href="/admin/teachers/new" className="btn btn-outline">Add Teacher</Link>
          </div>
        </div>

        <div className="portal-panel">
          <h2>Students</h2>
          {students.length === 0 ? <p>No students added yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Roll No.</th><th>Class</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}><td>{s.full_name}</td><td>{s.roll_no}</td><td>{s.classes?.name || "\u2014"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="portal-panel">
          <h2>Teachers</h2>
          {teachers.length === 0 ? <p>No teachers added yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Subject</th></tr></thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}><td>{t.full_name}</td><td>{t.subject || "\u2014"}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="portal-panel">
          <h2>Fee Overview</h2>
          {fees.length === 0 ? <p>No fee records yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Student</th><th>Charge</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id}>
                    <td>{f.students?.full_name}</td>
                    <td>{f.charge_name}</td>
                    <td>PKR {f.amount}</td>
                    <td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="portal-panel">
          <h2>Notices</h2>
          {notices.length === 0 ? <p>No notices posted yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Notice</th><th>Audience</th></tr></thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}><td>{new Date(n.created_at).toLocaleDateString()}</td><td>{n.title}</td><td>{n.audience}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "14px" }}>
            Posting notices from this screen is coming in a future update &mdash; for now, use the Supabase Table Editor for those.
          </p>
        </div>
      </div>
    </div>
  );
}
