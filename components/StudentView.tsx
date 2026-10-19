"use client";

import { useEffect, useState } from "react";
import {
  CalendarCheck,
  BookOpen,
  Award,
  Wallet,
  Clock,
  Bell,
  Coffee,
  LayoutGrid,
  CalendarDays,
  Receipt,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import TimetableGrid from "@/components/TimetableGrid";
import { localISODate, formatDate } from "@/lib/teacherUi";

type TabKey = "overview" | "attendance" | "homework" | "results" | "fees" | "timetable";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "attendance", label: "Attendance" },
  { key: "homework", label: "Homework" },
  { key: "results", label: "Results" },
  { key: "fees", label: "Fees" },
  { key: "timetable", label: "Timetable" },
];

const pillFor = (status: string) =>
  status === "present" ? "pill-green" : status === "leave" ? "pill-amber" : "pill-red";

// Shows everything about one student. Used by both the student and the parent portal.
export default function StudentView({
  student,
  audience,
}: {
  student: any;
  audience: "students" | "parents";
}) {
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [attendance, setAttendance] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  // Notices are the same for every child, so they load once
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("notices")
        .select("id, title, created_at")
        .in("audience", ["all", audience])
        .order("created_at", { ascending: false })
        .limit(5);
      setNotices(data || []);
    })();
  }, [audience]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      setTab("overview");
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const hasClass = !!student.class_id;

      const [att, asg, res, fee, tt] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, date, status")
          .eq("student_id", student.id)
          .gte("date", localISODate(since))
          .order("date", { ascending: false }),
        hasClass
          ? supabase.from("assignments").select("id, title, subject, due_date").eq("class_id", student.class_id).order("due_date", { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase.from("exam_results").select("*").eq("student_id", student.id),
        supabase.from("fees").select("*").eq("student_id", student.id),
        hasClass
          ? supabase.from("timetable_entries").select("*, teachers(full_name)").eq("class_id", student.class_id)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);
      if (cancelled) return;
      if (att.error || asg.error || res.error || fee.error || tt.error) {
        setLoadError("Some information couldn't be loaded. Please check your internet and try again.");
      }
      setAttendance(att.data || []);
      setAssignments(asg.data || []);
      setResults(res.data || []);
      setFees(fee.data || []);
      setTimetable(tt.data || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [student.id, student.class_id]);

  if (loading) {
    return (
      <div style={{ display: "grid", gap: 16 }} aria-busy="true">
        <div className="skeleton" style={{ height: 70 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const now = new Date();
  const todayISO = localISODate(now);
  const todayName = now.toLocaleDateString("en-US", { weekday: "long" });

  // Attendance
  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const onLeave = attendance.filter((a) => a.status === "leave").length;
  const attPct = attendance.length ? Math.round((present / attendance.length) * 100) : null;

  // Homework
  const upcoming = assignments.filter((a) => !a.due_date || a.due_date >= todayISO);
  const past = assignments.filter((a) => a.due_date && a.due_date < todayISO).reverse();

  // Results, grouped by exam
  const groups = new Map<string, any[]>();
  results.forEach((r) => {
    const key = `${r.exam_name || "Exam"}${r.term ? ` · ${r.term}` : ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  });
  const scored = results.filter((r) => Number(r.total_marks) > 0);
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, r) => a + (Number(r.marks_obtained) / Number(r.total_marks)) * 100, 0) / scored.length)
    : null;

  // Fees
  const unpaid = fees.filter((f) => f.status !== "paid");
  const unpaidTotal = unpaid.reduce((a, f) => a + (Number(f.amount) || 0), 0);

  // Today's classes
  const todaysPeriods = timetable
    .filter((e) => e.day_of_week === todayName)
    .sort((a, b) => a.period_number - b.period_number);

  return (
    <div>
      {loadError && <div className="t-error" role="alert"><span>{loadError}</span></div>}

      <div className="sv-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="t-stats">
            <div className="t-stat">
              <div className="icon-badge icon-badge-green"><CalendarCheck size={18} /></div>
              <div>
                <div className="t-stat-num">{attPct === null ? "—" : `${attPct}%`}</div>
                <div className="t-stat-label">Attendance (30 days)</div>
              </div>
            </div>
            <div className="t-stat">
              <div className="icon-badge icon-badge-amber"><BookOpen size={18} /></div>
              <div>
                <div className="t-stat-num">{upcoming.length}</div>
                <div className="t-stat-label">Homework due</div>
              </div>
            </div>
            <div className="t-stat">
              <div className="icon-badge icon-badge-blue"><Award size={18} /></div>
              <div>
                <div className="t-stat-num">{avgScore === null ? "—" : `${avgScore}%`}</div>
                <div className="t-stat-label">Average score</div>
              </div>
            </div>
            <div className="t-stat">
              <div className="icon-badge icon-badge-red"><Wallet size={18} /></div>
              <div>
                <div className="t-stat-num">{unpaid.length === 0 ? "Clear" : `PKR ${unpaidTotal.toLocaleString()}`}</div>
                <div className="t-stat-label">{unpaid.length === 0 ? "No fees due" : "Fees due"}</div>
              </div>
            </div>
          </div>

          <div className="t-grid">
            <div className="portal-panel">
              <h2>Today&apos;s Classes &mdash; {todayName}</h2>
              {todaysPeriods.length === 0 ? (
                <div className="t-empty">
                  <Coffee size={28} />
                  {timetable.length === 0 ? "The timetable hasn't been set up yet." : todayName === "Sunday" ? "No classes today." : "No classes scheduled today."}
                </div>
              ) : (
                todaysPeriods.map((p) => (
                  <div className="t-period" key={p.id}>
                    <div className="t-period-no">{p.period_number}</div>
                    <div>
                      <div className="t-period-subject">{p.subject}</div>
                      <div className="t-period-class">{p.teachers?.full_name || "—"}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="portal-panel">
              <h2><Bell size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Notices</h2>
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
          </div>

          <div className="portal-panel">
            <div className="t-row-between">
              <h2 style={{ margin: 0 }}>Next homework</h2>
              {upcoming.length > 3 && <button className="auth-link sv-link" onClick={() => setTab("homework")}>See all</button>}
            </div>
            {upcoming.length === 0 ? (
              <p>No homework due. Nice!</p>
            ) : (
              upcoming.slice(0, 3).map((a) => (
                <div className="t-period" key={a.id}>
                  <div className="t-period-no"><BookOpen size={16} /></div>
                  <div>
                    <div className="t-period-subject">{a.title}</div>
                    <div className="t-period-class">{a.subject}{a.due_date ? ` · Due ${formatDate(a.due_date)}` : ""}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {tab === "attendance" && (
        <>
          <div className="t-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="t-stat"><div><div className="t-stat-num">{present}</div><div className="t-stat-label">Present</div></div></div>
            <div className="t-stat"><div><div className="t-stat-num">{absent}</div><div className="t-stat-label">Absent</div></div></div>
            <div className="t-stat"><div><div className="t-stat-num">{onLeave}</div><div className="t-stat-label">On leave</div></div></div>
          </div>
          <div className="portal-panel">
            <h2>Last 30 days</h2>
            {attendance.length === 0 ? (
              <div className="t-empty"><CalendarDays size={28} />No attendance records yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td>{formatDate(a.date)}</td>
                        <td><span className={`pill ${pillFor(a.status)}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {tab === "homework" && (
        <>
          <div className="portal-panel">
            <h2>Upcoming</h2>
            {upcoming.length === 0 ? (
              <p>No homework due right now.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Title</th><th>Due</th></tr></thead>
                  <tbody>
                    {upcoming.map((a) => (
                      <tr key={a.id}><td>{a.subject}</td><td>{a.title}</td><td>{a.due_date ? formatDate(a.due_date) : "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {past.length > 0 && (
            <div className="portal-panel">
              <h2>Past</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Title</th><th>Was due</th></tr></thead>
                  <tbody>
                    {past.map((a) => (
                      <tr key={a.id}><td>{a.subject}</td><td>{a.title}</td><td>{formatDate(a.due_date)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "results" && (
        results.length === 0 ? (
          <div className="portal-panel"><div className="t-empty"><Award size={28} />No results recorded yet.</div></div>
        ) : (
          Array.from(groups.entries()).map(([examName, rows]) => {
            const got = rows.reduce((a, r) => a + (Number(r.marks_obtained) || 0), 0);
            const max = rows.reduce((a, r) => a + (Number(r.total_marks) || 0), 0);
            return (
              <div className="portal-panel" key={examName}>
                <div className="t-row-between">
                  <h2 style={{ margin: 0 }}>{examName}</h2>
                  {max > 0 && <span className="pill pill-green">{got}/{max} · {Math.round((got / max) * 100)}%</span>}
                </div>
                <div style={{ overflowX: "auto", marginTop: 8 }}>
                  <table className="data-table">
                    <thead><tr><th>Subject</th><th>Marks</th><th>%</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td>{r.subject}</td>
                          <td>{r.marks_obtained} / {r.total_marks}</td>
                          <td>{Number(r.total_marks) > 0 ? `${Math.round((Number(r.marks_obtained) / Number(r.total_marks)) * 100)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )
      )}

      {tab === "fees" && (
        <div className="portal-panel">
          <div className="t-row-between">
            <h2 style={{ margin: 0 }}>Fees</h2>
            {fees.length > 0 && (
              <span className={`pill ${unpaid.length === 0 ? "pill-green" : "pill-red"}`}>
                {unpaid.length === 0 ? "All clear" : `PKR ${unpaidTotal.toLocaleString()} due`}
              </span>
            )}
          </div>
          {fees.length === 0 ? (
            <div className="t-empty"><Receipt size={28} />No fee records yet.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <table className="data-table">
                <thead><tr><th>Charge</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {fees.map((f) => (
                    <tr key={f.id}>
                      <td>{f.charge_name}</td>
                      <td>PKR {Number(f.amount).toLocaleString()}</td>
                      <td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "timetable" && (
        <div className="portal-panel">
          <h2><Clock size={16} style={{ verticalAlign: "-2px", marginRight: 6 }} />Weekly Timetable</h2>
          <TimetableGrid entries={timetable} showTeacher />
        </div>
      )}
    </div>
  );
}
