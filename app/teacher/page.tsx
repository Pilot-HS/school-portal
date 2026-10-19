"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  School,
  BookOpen,
  ClipboardCheck,
  FileText,
  Users,
  CalendarOff,
  CalendarDays,
  CalendarCheck,
  Bell,
  ChevronRight,
  Clock,
  Coffee,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import TimetableGrid from "@/components/TimetableGrid";
import { useTeacher } from "@/components/TeacherShell";
import { classLabel, localISODate, formatDate } from "@/lib/teacherUi";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function TeacherDashboard() {
  const router = useRouter();
  const { role, fullName, teacher, timetable } = useTeacher();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    const [asgRes, noticeRes] = await Promise.all([
      teacher
        ? supabase
            .from("assignments")
            .select("id, title, subject, due_date, classes(name, grade, section)")
            .eq("created_by", teacher.id)
            .order("due_date", { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null }),
      supabase
        .from("notices")
        .select("id, title, created_at")
        .in("audience", ["all", "teachers"])
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    if (asgRes.error || noticeRes.error) {
      setLoadError("Some information couldn't be loaded. Please check your internet and try again.");
    }
    setAssignments(asgRes.data || []);
    setNotices(noticeRes.data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (role === "admin") {
      router.replace("/admin");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (role === "admin") return null;

  const now = new Date();
  const todayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayLabel = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const todaysPeriods = timetable
    .filter((e) => e.day_of_week === todayName)
    .sort((a, b) => a.period_number - b.period_number);

  const myClassNames = Array.from(new Set(timetable.map((e) => e.classes?.name).filter(Boolean))) as string[];

  const todayISO = localISODate(now);
  const plus = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return localISODate(d);
  };
  const weekAheadISO = plus(7);
  const soonISO = plus(3);
  const dueThisWeek = assignments.filter((a) => a.due_date && a.due_date >= todayISO && a.due_date <= weekAheadISO).length;
  const recentAssignments = assignments.slice(0, 5);

  const actions = [
    { href: "/teacher/attendance", title: "Mark Attendance", desc: "Take attendance in a few taps", icon: ClipboardCheck, tone: "green" },
    { href: "/teacher/tests", title: "Tests & Exams", desc: "Create a test, enter marks", icon: FileText, tone: "blue" },
    { href: "/teacher/assignments/new", title: "Post Assignment", desc: "Share homework with a class", icon: BookOpen, tone: "amber" },
    { href: "/teacher/students", title: "My Students", desc: "Class lists and attendance", icon: Users, tone: "green" },
    { href: "/teacher/leave", title: "Apply for Leave", desc: "Send a request to the admin", icon: CalendarOff, tone: "red" },
    { href: "/teacher/assignments", title: "My Assignments", desc: "Edit or remove homework", icon: BookOpen, tone: "blue" },
  ];

  return (
    <div className="portal-main">
      <div className="t-hero">
        <div className="t-hero-date">{todayLabel}</div>
        <h1>
          {greeting()}, {fullName}
        </h1>
        <div style={{ position: "relative", zIndex: 1 }}>
          <span className="t-chip">
            <BookOpen size={14} /> {teacher?.subject ? `${teacher.subject} Teacher` : "Teacher"}
          </span>
          <span className="t-chip">
            <Clock size={14} /> {todaysPeriods.length} {todaysPeriods.length === 1 ? "period" : "periods"} today
          </span>
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
          <div className="icon-badge icon-badge-amber"><CalendarCheck size={18} /></div>
          <div>
            <div className="t-stat-num">{todaysPeriods.length}</div>
            <div className="t-stat-label">Periods today</div>
          </div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-blue"><School size={18} /></div>
          <div>
            <div className="t-stat-num">{myClassNames.length}</div>
            <div className="t-stat-label">Your classes</div>
          </div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-green"><BookOpen size={18} /></div>
          <div>
            <div className="t-stat-num">{loading ? "…" : assignments.length}</div>
            <div className="t-stat-label">Assignments posted</div>
          </div>
        </div>
        <div className="t-stat">
          <div className="icon-badge icon-badge-red"><CalendarDays size={18} /></div>
          <div>
            <div className="t-stat-num">{loading ? "…" : dueThisWeek}</div>
            <div className="t-stat-label">Due in 7 days</div>
          </div>
        </div>
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

      <div className="t-grid">
        <div className="portal-panel">
          <h2>Today&apos;s Classes &mdash; {todayName}</h2>
          {todaysPeriods.length === 0 ? (
            <div className="t-empty">
              <Coffee size={28} />
              {timetable.length === 0
                ? "Your timetable hasn't been set up yet. Ask the admin to add it."
                : todayName === "Sunday"
                ? "No classes today. Enjoy your day off!"
                : "No classes scheduled for you today."}
            </div>
          ) : (
            todaysPeriods.map((p) => (
              <div className="t-period" key={p.id}>
                <div className="t-period-no">{p.period_number}</div>
                <div>
                  <div className="t-period-subject">{p.subject}</div>
                  <div className="t-period-class">Class {p.classes?.name || "—"}</div>
                </div>
                <Link href="/teacher/attendance" className="auth-link" style={{ marginLeft: "auto" }}>
                  Attendance
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="portal-panel">
          <h2>
            <Bell size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />
            Notices
          </h2>
          {loading ? (
            <div className="skeleton" style={{ height: 90 }} />
          ) : notices.length === 0 ? (
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
      </div>

      <div className="portal-panel">
        <h2>Your Classes</h2>
        {myClassNames.length === 0 ? (
          <p>No classes assigned to you yet &mdash; ask the admin to add your timetable.</p>
        ) : (
          <div className="t-class-chips">
            {myClassNames.map((name) => (
              <span className="t-class-chip" key={name}>Class {name}</span>
            ))}
          </div>
        )}
      </div>

      <div className="portal-panel">
        <div className="t-row-between">
          <h2 style={{ margin: 0 }}>Recent Assignments</h2>
          <Link href="/teacher/assignments" className="auth-link">View all</Link>
        </div>
        {loading ? (
          <div className="skeleton" style={{ height: 90, marginTop: 12 }} />
        ) : recentAssignments.length === 0 ? (
          <p>You haven&apos;t posted any assignments yet.</p>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="data-table">
              <thead>
                <tr><th>Class</th><th>Subject</th><th>Title</th><th>Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recentAssignments.map((a) => {
                  const closed = !!a.due_date && a.due_date < todayISO;
                  const soon = !!a.due_date && !closed && a.due_date <= soonISO;
                  return (
                    <tr key={a.id}>
                      <td>{classLabel(a.classes)}</td>
                      <td>{a.subject}</td>
                      <td>{a.title}</td>
                      <td>{a.due_date ? formatDate(a.due_date) : "—"}</td>
                      <td>
                        <span className={`pill ${closed ? "pill-gray" : soon ? "pill-amber" : "pill-green"}`}>
                          {closed ? "Closed" : soon ? "Due soon" : "Open"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="portal-panel">
        <h2>Your Weekly Timetable</h2>
        <TimetableGrid entries={timetable} showTeacher={false} showClass />
      </div>
    </div>
  );
}
