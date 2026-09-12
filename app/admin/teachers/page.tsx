"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function TeachersListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadTeachers() {
    const { data } = await supabase.from("teachers").select("*").order("full_name");
    setTeachers(data || []);
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
      await loadTeachers();
      setLoading(false);
    })();
  }, [router]);

  async function toggleActive(teacherId: string, currentActive: boolean) {
    setTogglingId(teacherId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/toggle-teacher-active", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teacher_id: teacherId, is_active: !currentActive }),
    });

    await loadTeachers();
    setTogglingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Teachers</h1>
        <Link href="/admin/teachers/new" className="btn btn-primary">Add Teacher</Link>
      </div>

      <div className="portal-panel">
        {teachers.length === 0 ? <p>No teachers added yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Subject</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {teachers.map((t) => {
                const isActive = t.is_active !== false;
                return (
                  <tr key={t.id}>
                    <td>{t.full_name}</td>
                    <td>{t.subject || "\u2014"}</td>
                    <td><span className={`pill ${isActive ? "pill-green" : "pill-red"}`}>{isActive ? "Active" : "Inactive"}</span></td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <Link href={`/admin/teachers/${t.id}/edit`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>Edit</Link>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                        disabled={togglingId === t.id}
                        onClick={() => toggleActive(t.id, isActive)}
                      >
                        {togglingId === t.id ? "…" : isActive ? "Deactivate" : "Activate"}
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
