"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, GraduationCap, Wallet, Bell, LayoutDashboard, UserPlus, School, Megaphone } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";
import BarChart from "@/components/BarChart";
import DonutChart from "@/components/DonutChart";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [togglingFeeId, setTogglingFeeId] = useState<string | null>(null);

  async function loadAll() {
    const [{ data: studentData }, { data: teacherData }, { data: feeData }, { data: noticeData }, { data: attendanceData }] = await Promise.all([
      supabase.from("students").select("*, classes(name)").order("full_name"),
      supabase.from("teachers").select("*"),
      supabase.from("fees").select("*, students(full_name)"),
      supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(5),
      supabase.from("attendance").select("date, status").order("date", { ascending: false }).limit(500),
    ]);
    setStudents(studentData || []);
    setTeachers(teacherData || []);
    setFees(feeData || []);
    setNotices(noticeData || []);
    setAttendance(attendanceData || []);
  }

  async function toggleFeeStatus(feeId: string, currentStatus: string) {
    setTogglingFeeId(feeId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const newStatus = currentStatus === "paid" ? "unpaid" : "paid";

    await fetch("/api/admin/update-fee-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fee_id: feeId, status: newStatus }),
    });

    await loadAll();
    setTogglingFeeId(null);
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

      await loadAll();
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const unpaidCount = fees.filter((f) => f.status === "unpaid").length;
  const paidCount = fees.filter((f) => f.status === "paid").length;

  const dayMap: Record<string, { present: number; total: number }> = {};
  attendance.forEach((a) => {
    if (!dayMap[a.date]) dayMap[a.date] = { present: 0, total: 0 };
    dayMap[a.date].total += 1;
    if (a.status === "present") dayMap[a.date].present += 1;
  });
  const recentDates = Object.keys(dayMap).sort().slice(-5);
  const attendanceChartData = recentDates.map((d) => ({
    label: new Date(d).toLocaleDateString(undefined, { weekday: "short" }),
    value: dayMap[d].total > 0 ? Math.round((dayMap[d].present / dayMap[d].total) * 100) : 0,
  }));

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="admin-shell">
        <div className="admin-sidebar">
          <a href="#" className="active"><LayoutDashboard size={16} /> Dashboard</a>
          <a href="/admin/students/new"><Users size={16} /> Students</a>
          <a href="/admin/teachers/new"><GraduationCap size={16} /> Teachers</a>
          <a href="/admin/classes"><School size={16} /> Classes</a>
          <a href="/admin/fees/new"><Wallet size={16} /> Fees</a>
          <a href="/admin/notices/new"><Megaphone size={16} /> Notices</a>
          <a href="/admin/create-user"><UserPlus size={16} /> Accounts</a>
        </div>

        <div className="admin-content">
          <h1 style={{ fontSize: "1.5rem" }}>Admin Dashboard</h1>
          <p style={{ color: "var(--muted)", marginBottom: "24px" }}>Government Boys High School, P.H. Pilot, Dadu</p>

          <div className="portal-cards">
            <div className="icon-stat-card">
              <div className="icon-badge icon-badge-blue"><Users size={18} /></div>
              <div className="icon-stat-num">{students.length}</div>
              <div className="icon-stat-label">Total students</div>
            </div>
            <div className="icon-stat-card">
              <div className="icon-badge icon-badge-green"><GraduationCap size={18} /></div>
              <div className="icon-stat-num">{teachers.length}</div>
              <div className="icon-stat-label">Teachers &amp; staff</div>
            </div>
            <div className="icon-stat-card">
              <div className="icon-badge icon-badge-red"><Wallet size={18} /></div>
              <div className="icon-stat-num">{unpaidCount}</div>
              <div className="icon-stat-label">Unpaid fee records</div>
            </div>
            <div className="icon-stat-card">
              <div className="icon-badge icon-badge-amber"><Bell size={18} /></div>
              <div className="icon-stat-num">{notices.length}</div>
              <div className="icon-stat-label">Recent notices</div>
            </div>
          </div>

          <div className="chart-row">
            <div className="portal-panel" style={{ marginBottom: 0 }}>
              <h2>Attendance Rate — Last 5 Days</h2>
              {attendanceChartData.length === 0 ? (
                <p>No attendance data yet.</p>
              ) : (
                <BarChart data={attendanceChartData} />
              )}
            </div>
            <div className="portal-panel" style={{ marginBottom: 0 }}>
              <h2>Fee Collection</h2>
              {fees.length === 0 ? (
                <p>No fee records yet.</p>
              ) : (
                <DonutChart
                  segments={[
                    { label: "Paid", value: paidCount, color: "#2f6b4f" },
                    { label: "Unpaid", value: unpaidCount, color: "#c65c5c" },
                  ]}
                />
              )}
            </div>
          </div>

          <div className="portal-panel">
            <h2>Manage Classes, Students &amp; Teachers</h2>
            <p>Add classes, then add student and teacher records — and link them to logins you've already created.</p>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href="/admin/classes" className="btn btn-outline">Manage Classes</Link>
              <Link href="/admin/students/new" className="btn btn-outline">Add Student</Link>
              <Link href="/admin/teachers/new" className="btn btn-outline">Add Teacher</Link>
              <Link href="/admin/create-user" className="btn btn-primary">Create New Account</Link>
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
                <thead><tr><th>Student</th><th>Charge</th><th>Amount</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id}>
                      <td>{f.students?.full_name}</td>
                      <td>{f.charge_name}</td>
                      <td>PKR {f.amount}</td>
                      <td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td>
                      <td>
                        <button
                          className="btn btn-outline"
                          style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                          disabled={togglingFeeId === f.id}
                          onClick={() => toggleFeeStatus(f.id, f.status)}
                        >
                          {togglingFeeId === f.id ? "…" : f.status === "paid" ? "Mark unpaid" : "Mark paid"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Link href="/admin/fees/new" className="btn btn-outline" style={{ marginTop: "16px" }}>Add Fee Record</Link>
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
            <Link href="/admin/notices/new" className="btn btn-outline" style={{ marginTop: "16px" }}>Post a Notice</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
