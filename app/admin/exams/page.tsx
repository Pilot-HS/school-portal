"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function ExamsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [examFilter, setExamFilter] = useState("all");

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
        .from("exam_results")
        .select("*, students(full_name, classes(name))")
        .order("exam_name");
      setResults(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const examNames = Array.from(new Set(results.map((r) => r.exam_name)));
  const filtered = examFilter === "all" ? results : results.filter((r) => r.exam_name === examFilter);

  return (
    <AdminLayout active="exams" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }}>Exams &amp; Results</h1>

      <div className="portal-panel">
        {results.length === 0 ? (
          <p>No exam results have been recorded yet. Teachers can enter these from their dashboard.</p>
        ) : (
          <>
            <div className="form-field" style={{ maxWidth: "260px" }}>
              <label htmlFor="exam_filter">Filter by exam</label>
              <select id="exam_filter" value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
                <option value="all">All exams</option>
                {examNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <table className="data-table">
              <thead><tr><th>Student</th><th>Class</th><th>Subject</th><th>Exam</th><th>Marks</th></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.students?.full_name}</td>
                    <td>{r.students?.classes?.name || "\u2014"}</td>
                    <td>{r.subject}</td>
                    <td>{r.exam_name}</td>
                    <td>{r.marks_obtained} / {r.total_marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
