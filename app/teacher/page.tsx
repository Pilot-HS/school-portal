"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function TeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [teacher, setTeacher] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
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

      if (!profile || profile.role !== "teacher") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("*")
        .eq("profile_id", session.user.id)
        .single();
      setTeacher(teacherRow);

      const { data: classData } = await supabase.from("classes").select("*").order("grade");
      setClasses(classData || []);

      if (teacherRow) {
        const { data: asg } = await supabase
          .from("assignments")
          .select("*, classes(name)")
          .eq("created_by", teacherRow.id)
          .order("due_date", { ascending: false });
        setAssignments(asg || []);
      }

      const { data: noticesData } = await supabase
        .from("notices")
        .select("*")
        .in("audience", ["all", "teachers"])
        .order("created_at", { ascending: false })
        .limit(5);
      setNotices(noticesData || []);

      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="teacher" fullName={fullName} />
      <div className="portal-main">
        <h1 style={{ fontSize: "1.5rem" }}>Welcome, {fullName}</h1>
        <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
          {teacher?.subject ? `${teacher.subject} Teacher` : "Teacher"}
        </p>

        <div className="portal-cards">
          <div className="portal-stat-card"><div className="ps-num">{classes.length}</div><div className="ps-label">Classes in the school</div></div>
          <div className="portal-stat-card"><div className="ps-num">{assignments.length}</div><div className="ps-label">Assignments you've posted</div></div>
        </div>

        <div className="portal-panel">
          <h2>Classes</h2>
          {classes.length === 0 ? <p>No classes set up yet &mdash; ask the admin to add them.</p> : (
            <table className="data-table">
              <thead><tr><th>Grade</th><th>Section</th></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}><td>{c.grade}</td><td>{c.section}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="portal-panel">
          <h2>Your Assignments</h2>
          {assignments.length === 0 ? <p>You haven't posted any assignments yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Class</th><th>Subject</th><th>Title</th><th>Due</th></tr></thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}><td>{a.classes?.name}</td><td>{a.subject}</td><td>{a.title}</td><td>{a.due_date}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <p style={{ fontSize: "0.82rem", color: "var(--muted)", marginTop: "14px" }}>
            Posting new assignments and marking attendance from this screen is coming in the next update &mdash; for now, the admin can add these directly via the Supabase Table Editor.
          </p>
        </div>

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
