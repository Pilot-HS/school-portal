"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function StudentsListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadStudents() {
    const { data } = await supabase.from("students").select("*, classes(name)").order("full_name");
    setStudents(data || []);
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
      await loadStudents();
      setLoading(false);
    })();
  }, [router]);

  async function toggleActive(studentId: string, currentActive: boolean) {
    setTogglingId(studentId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/toggle-student-active", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_id: studentId, is_active: !currentActive }),
    });

    await loadStudents();
    setTogglingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Students</h1>
        <Link href="/admin/students/new" className="btn btn-primary">Add Student</Link>
      </div>

      <div className="portal-panel">
        {students.length === 0 ? <p>No students added yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Roll No.</th><th>Class</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {students.map((s) => {
                const isActive = s.is_active !== false;
                return (
                  <tr key={s.id}>
                    <td>{s.full_name}</td>
                    <td>{s.roll_no}</td>
                    <td>{s.classes?.name || "\u2014"}</td>
                    <td><span className={`pill ${isActive ? "pill-green" : "pill-red"}`}>{isActive ? "Active" : "Inactive"}</span></td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <Link href={`/admin/students/${s.id}/edit`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>Edit</Link>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                        disabled={togglingId === s.id}
                        onClick={() => toggleActive(s.id, isActive)}
                      >
                        {togglingId === s.id ? "…" : isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
