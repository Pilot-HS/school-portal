"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  School,
  BookOpen,
  ClipboardCheck,
  Award,
  CalendarDays,
  CalendarCheck,
  Bell,
  ChevronRight,
  Clock,
  Coffee,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";
import TimetableGrid from "@/components/TimetableGrid";

function localISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function DashboardSkeleton() {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading dashboard">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

export default function TeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [teacher, setTeacher] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      // Step 1: who is this? (profile + teacher record fetched together)
      const [{ data: profile }, { data: teacherRow }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("teachers").select("id, subject").eq("profile_id", session.user.id).maybeSingle(),
      ]);

      if (!profile || profile.role !== "teacher") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setTeacher(teacherRow);

      // Step 2: everything else at the same time
      const [asgRes, ttRes, noticeRes] = await Promise.all([
        teacherRow
          ? supabase
              .from("assignments")
              .select("id, title, subject, due_date, classes(name)")
              .eq("created_by", teacherRow.id)
              .order("due_date", { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
        teacherRow
          ? supabase.from("timetable_entries").select("*, classes(name)").eq("teacher_id", teacherRow.id)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from("notices")
          .select("id, title, created_at")
          .in("audience", ["all", "teachers"])
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      if (asgRes.error || ttRes.error || noticeRes.error) {
        throw new Error("Some information could not be loaded.");
      }

      setAssignments(asgRes.data || []);
      setTimetable(ttRes.data || []);
      setNotices(noticeRes.data || []);
    } catch (err) {
      setLoadError("We couldn't load everything just now. Please check your internet and try again.");
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  // ----- Work out today's view -----
  const now = new Date();
  const todayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const todaysPeriods = timetable
    .filter((e) => e.day_of_week === todayName)
    .sort((a, b) => a.period_number - b.period_number);

  const myClassNames = Array.from(
    new Set(timetable.map((e) => e.classes?.name).filter(Boolean))
  ) as string[];

  const todayISO = localISODate(now);
  const weekAhead = new Date(now);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAheadISO = localISODate(weekAhead);
  const soonISO = (() => {
    const d = new Date(now);
    d.setDate(d.getDate() + 3);
    return localISODate(d);
  })();

  const dueThisWeek = assignments.filter((a) => a.due_date >= todayISO && a.due_date <= weekAheadISO).length;
  const recentAssignments = assignments.slice(0, 5);

  return (
    <div>
      <PortalNav role="teacher" fullName={fullName} />
      <div className="portal-main">
        {/* Greeting */}
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

        {/* Stats */}
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
              <div className="t-stat-num">{assignments.length}</div>
              <div className="t-stat-label">Assignments posted</div>
            </div>
          </div>
          <div className="t-stat">
            <div className="icon-badge icon-badge-red"><CalendarDays size={18} /></div>
            <div>
              <div className="t-stat-num">{dueThisWeek}</div>
              <div className="t-stat-label">Due in 7 days</div>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <h2 className="t-section-title">Quick actions</h2>
        <div className="t-actions">
          <Link href="/teacher/attendance" className="t-action">
            <div className="icon-badge icon-badge-green"><ClipboardCheck size={22} /></div>
            <div>
              <div className="t-action-title">Mark Attendance</div>
              <div className="t-action-desc">Take attendance for any class</div>
            </div>
            <ChevronRight size={18} className="t-action-arrow" />
          </Link>
          <Link href="/teacher/assignments/new" className="t-action">
            <div className="icon-badge icon-badge-amber"><BookOpen size={22} /></div>
            <div>
              <div className="t-action-title">Post Assignment</div>
              <div className="t-action-desc">Share homework with a class</div>
            </div>
            <ChevronRight size={18} className="t-action-arrow" />
          </Link>
          <Link href="/teacher/exams/new" className="t-action">
            <div className="icon-badge icon-badge-blue"><Award size={22} /></div>
            <div>
              <div className="t-action-title">Enter Exam Results</div>
              <div className="t-action-desc">Record marks for a whole class</div>
            </div>
            <ChevronRight size={18} className="t-action-arrow" />
          </Link>
        </div>

        {/* Today + Notices */}
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
            {notices.length === 0 ? (
              <div className="t-empty">No notices posted yet.</div>
            ) : (
              notices.map((n) => (
                <div className="t-notice" key={n.id}>
                  <div className="t-notice-title">{n.title}</div>
                  <div className="t-notice-date">{new Date(n.created_at).toLocaleDateString("en-GB")}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Your classes */}
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

        {/* Assignments */}
        <div className="portal-panel">
          <h2>Recent Assignments</h2>
          {recentAssignments.length === 0 ? (
            <p>You haven&apos;t posted any assignments yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr><th>Class</th><th>Subject</th><th>Title</th><th>Due</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {recentAssignments.map((a) => {
                    const closed = a.due_date < todayISO;
                    const soon = !closed && a.due_date <= soonISO;
                    return (
                      <tr key={a.id}>
                        <td>{a.classes?.name}</td>
                        <td>{a.subject}</td>
                        <td>{a.title}</td>
                        <td>{a.due_date}</td>
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

        {/* Weekly timetable */}
        <div className="portal-panel">
          <h2>Your Weekly Timetable</h2>
          <TimetableGrid entries={timetable} showTeacher={false} showClass />
        </div>
      </div>
    </div>
  );
}
