"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function AssignmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [assignments, setAssignments] = useState<any[]>([]);

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

      const { data } = await supabase
        .from("assignments")
        .select("*, classes(name), teachers(full_name)")
        .order("due_date", { ascending: false });
      setAssignments(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="assignments" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }}>Assignments</h1>
      <div className="portal-panel">
        {assignments.length === 0 ? (
          <p>No assignments have been posted yet. Teachers can post these from their dashboard.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Class</th><th>Subject</th><th>Title</th><th>Due Date</th><th>Posted By</th></tr></thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td>{a.classes?.name || "\u2014"}</td>
                  <td>{a.subject}</td>
                  <td>{a.title}</td>
                  <td>{a.due_date || "\u2014"}</td>
                  <td>{a.teachers?.full_name || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
