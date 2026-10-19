"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  Wallet,
  CalendarCheck,
  UserPlus,
  Megaphone,
  CalendarClock,
  FileBarChart,
  UserCheck,
  CalendarOff,
  ChevronRight,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import BarChart from "@/components/BarChart";
import DonutChart from "@/components/DonutChart";
import { localISODate, formatDate } from "@/lib/teacherUi";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type DayStat = { date: string; total: number; present: number };

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [studentCount, setStudentCount] = useState(0);
  const [teacherCount, setTeacherCount] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [notices, setNotices] = useState<any[]>([]);
  const [days, setDays] = useState<DayStat[]>([]);

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
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

      // Last 7 calendar days, counted with lightweight "count only" requests
      const dateList: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dateList.push(localISODate(d));
      }
      const head = { count: "exact" as const, head: true };
      const dayQueries = dateList.flatMap((d) => [
        supabase.from("attendance").select("id", head).eq("date", d),
        supabase.from("attendance").select("id", head).eq("date", d).eq("status", "present"),
      ]);

      const [studentsRes, teachersRes, paidRes, unpaidRes, leaveRes, noticeRes, ...dayRes] = await Promise.all([
        supabase.from("students").select("id", head),
        supabase.from("teachers").select("id", head),
        supabase.from("fees").select("id", head).eq("status", "paid"),
        supabase.from("fees").select("id", head).eq("status", "unpaid"),
        supabase.from("leave_requests").select("id", head).eq("status", "pending"),
        supabase.from("notices").select("id, title, created_at").order("created_at", { ascending: false }).limit(4),
        ...dayQueries,
      ]);

      setStudentCount(studentsRes.count || 0);
      setTeacherCount(teachersRes.count || 0);
      setPaidCount(paidRes.count || 0);
      setUnpaidCount(unpaidRes.count || 0);
      setPendingLeave(leaveRes.count || 0);
      setNotices(noticeRes.data || []);

      const stats: DayStat[] = dateList.map((date, i) => ({
        date,
        total: dayRes[i * 2]?.count || 0,
        present: dayRes[i * 2 + 1]?.count || 0,
      }));
      setDays(stats);

      if (studentsRes.error || teachersRes.error || paidRes.error || unpaidRes.error) {
        setLoadError("Some numbers couldn't be loaded. Please try again.");
      }
    } catch {
      setLoadError("We couldn't load the dashboard. Please check your internet and try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="skeleton-wrap" aria-busy="true" aria-label="Loading dashboard">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 80 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  const now = new Date();
  const todayISO = localISODate(now);
  const todayLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const todayStat = days.find((d) => d.date === todayISO);
  const todayPct = todayStat && todayStat.total > 0 ? Math.round((todayStat.present / todayStat.total) * 100) : null;

  const chartData = days
    .filter((d) => d.total > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-5)
    .map((d) => ({
      label: new Date(`${d.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short" }),
      value: Math.round((d.present / d.total) * 100),
    }));

  const attention = [
    pendingLeave > 0 && { href: "/admin/leave-requests", icon: CalendarOff, text: `${pendingLeave} leave ${pendingLeave === 1 ? "request" : "requests"} waiting for approval` },
    unpaidCount > 0 && { href: "/admin/fees", icon: Wallet, text: `${unpaidCount} unpaid fee ${unpaidCount === 1 ? "record" : "records"}` },
    now.getDay() !== 0 && (todayStat === undefined || todayStat.total === 0)
      ? { href: "/teacher/attendance", icon: CalendarCheck, text: "No student attendance has been marked today" }
      : false,
  ].filter(Boolean) as { href: string; icon: any; text: string }[];

  const actions = [
    { href: "/admin/students/new", title: "Add Student", desc: "Enrol a new student", icon: Users, tone: "blue" },
    { href: "/admin/teachers/new", title: "Add Teacher", desc: "Add a staff member", icon: GraduationCap, tone: "green" },
    { href: "/admin/notices/new", title: "Post a Notice", desc: "Tell students, parents or staff", icon: Megaphone, tone: "amber" },
    { href: "/admin/create-user", title: "Create Account", desc: "Give someone a login", icon: UserPlus, tone: "green" },
    { href: "/admin/timetable", title: "Timetable", desc: "Set up class periods", icon: CalendarClock, tone: "blue" },
    { href: "/admin/reports", title: "Reports", desc: "View and print reports", icon: FileBarChart, tone: "red" },
  ];

  return (
    <AdminLayout active="dashboard" fullName={fullName}>
      <div className="t-hero">
        <div className="t-hero-date">{todayLabel}</div>
        <h1>{greeting()}, {fullName}</h1>
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="t-chip">Government Boys High School, P.H. Pilot, Dadu</span>
        </div>
      </div>

      {loadError && (
        <div className="t-error" role="alert">
          <span>{loadError}</span>
          <button className="btn btn-outline" onClick={load}>Try again</button>
        </div>
      )}

      <div className="t-stats">
        <div className="t-stat">
          <div className="icon-badge icon-badge-blue"><Users size={18} /></div>
          <div><div className="t-stat-num">{studentCount}</div><div className="t-stat-label">Total students</div></div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-green"><GraduationCap size={18} /></div>
          <div><div className="t-stat-num">{teacherCount}</div><div className="t-stat-label">Teachers &amp; staff</div></div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-amber"><CalendarCheck size={18} /></div>
          <div><div className="t-stat-num">{todayPct === null ? "—" : `${todayPct}%`}</div><div className="t-stat-label">Present today</div></div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-red"><Wallet size={18} /></div>
          <div><div className="t-stat-num">{unpaidCount}</div><div className="t-stat-label">Unpaid fee records</div></div>
        </div>
      </div>

      <div className="portal-panel">
        <h2>Needs your attention</h2>
        {attention.length === 0 ? (
          <div className="t-empty"><CheckCircle2 size={28} />All caught up. Nothing is waiting for you.</div>
        ) : (
          attention.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.href + a.text} href={a.href} className="admin-attention">
                <span className="icon-badge icon-badge-amber" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}><Icon size={17} /></span>
                <span>{a.text}</span>
                <ChevronRight size={18} className="t-action-arrow" />
              </Link>
            );
          })
        )}
      </div>

      <h2 className="t-section-title">Quick actions</h2>
      <div className="t-actions">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link key={a.title} href={a.href} className="t-action">
              <div className={`icon-badge icon-badge-${a.tone}`}><Icon size={22} /></div>
              <div>
                <div className="t-action-title">{a.title}</div>
                <div className="t-action-desc">{a.desc}</div>
              </div>
              <ChevronRight size={18} className="t-action-arrow" />
            </Link>
          );
        })}
      </div>

      <div className="chart-row">
        <div className="portal-panel" style={{ marginBottom: 0 }}>
          <h2>Attendance Rate &mdash; Recent Days</h2>
          {chartData.length === 0 ? <p>No attendance data in the last 7 days.</p> : <BarChart data={chartData} />}
        </div>
        <div className="portal-panel" style={{ marginBottom: 0 }}>
          <h2>Fee Collection</h2>
          {paidCount + unpaidCount === 0 ? (
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

      <div className="portal-panel" style={{ marginTop: 22 }}>
        <div className="t-row-between">
          <h2 style={{ margin: 0 }}><Bell size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Latest notices</h2>
          <Link href="/admin/notices" className="auth-link">View all</Link>
        </div>
        {notices.length === 0 ? (
          <div className="t-empty">No notices posted yet.</div>
        ) : (
          notices.map((n) => (
            <div className="t-notice" key={n.id}>
              <div className="t-notice-title">{n.title}</div>
              <div className="t-notice-date">{formatDate(n.created_at)}</div>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
