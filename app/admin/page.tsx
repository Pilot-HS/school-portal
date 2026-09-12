"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, GraduationCap, Wallet, Bell } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import BarChart from "@/components/BarChart";
import DonutChart from "@/components/DonutChart";

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [fees, setFees] = useState<any[]>([]);
  const [noticeCount, setNoticeCount] = useState(0);
  const [attendance, setAttendance] = useState<any[]>([]);

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

      const [{ count: sCount }, { count: tCount }, { data: feeData }, { count: nCount }, { data: attendanceData }] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }),
        supabase.from("teachers").select("*", { count: "exact", head: true }),
        supabase.from("fees").select("status"),
        supabase.from("notices").select("*", { count: "exact", head: true }),
        supabase.from("attendance").select("date, status").order("date", { ascending: false }).limit(500),
      ]);
      setStudentCount(sCount || 0);
      setTeacherCount(tCount || 0);
      setFees(feeData || []);
      setNoticeCount(nCount || 0);
      setAttendance(attendanceData || []);

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
    <AdminLayout active="dashboard" fullName={fullName}>
      <h1 style={{ fontSize: "1.5rem" }}>Admin Dashboard</h1>
      <p style={{ color: "var(--muted)", marginBottom: "24px" }}>Government Boys High School, P.H. Pilot, Dadu</p>

      <div className="portal-cards">
        <div className="icon-stat-card">
          <div className="icon-badge icon-badge-blue"><Users size={18} /></div>
          <div className="icon-stat-num">{studentCount}</div>
          <div className="icon-stat-label">Total students</div>
        </div>
        <div className="icon-stat-card">
          <div className="icon-badge icon-badge-green"><GraduationCap size={18} /></div>
          <div className="icon-stat-num">{teacherCount}</div>
          <div className="icon-stat-label">Teachers &amp; staff</div>
        </div>
        <div className="icon-stat-card">
          <div className="icon-badge icon-badge-red"><Wallet size={18} /></div>
          <div className="icon-stat-num">{unpaidCount}</div>
          <div className="icon-stat-label">Unpaid fee records</div>
        </div>
        <div className="icon-stat-card">
          <div className="icon-badge icon-badge-amber"><Bell size={18} /></div>
          <div className="icon-stat-num">{noticeCount}</div>
          <div className="icon-stat-label">Recent notices</div>
        </div>
      </div>

      <div className="chart-row">
        <div className="portal-panel" style={{ marginBottom: 0 }}>
          <h2>Attendance Rate — Last 5 Days</h2>
          {attendanceChartData.length === 0 ? <p>No attendance data yet.</p> : <BarChart data={attendanceChartData} />}
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
        <h2>Quick Actions</h2>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/admin/students/new" className="btn btn-outline">Add Student</Link>
          <Link href="/admin/teachers/new" className="btn btn-outline">Add Teacher</Link>
          <Link href="/admin/classes" className="btn btn-outline">Manage Classes</Link>
          <Link href="/admin/notices/new" className="btn btn-outline">Post a Notice</Link>
          <Link href="/admin/create-user" className="btn btn-primary">Create New Account</Link>
        </div>
      </div>
    </AdminLayout>
  );
}
