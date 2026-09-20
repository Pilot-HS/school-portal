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
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadTeachers(token: string) {
    const { data } = await supabase.from("teachers").select("*").order("full_name");
    setTeachers(data || []);

    const withPhotos = (data || []).filter((t) => t.photo_path);
    const urls: Record<string, string> = {};
    await Promise.all(
      withPhotos.map(async (t) => {
        const res = await fetch("/api/admin/get-signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: t.photo_path }),
        });
        const result = await res.json();
        if (res.ok) urls[t.id] = result.url;
      })
    );
    setPhotoUrls(urls);
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
      await loadTeachers(session.access_token);
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

    await loadTeachers(token!);
    setTogglingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const filtered = teachers.filter((t) => {
    const isActive = t.is_active !== false;
    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "inactive" && isActive) return false;
    if (searchText && !t.full_name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  function exportToCsv() {
    const headers = ["Name", "Employee Number", "Designation", "BPS Grade", "Mobile", "Status"];
    const rows = filtered.map((t) => [
      t.full_name,
      t.employee_number || "",
      t.designation || "",
      t.bps_grade || "",
      t.mobile_number || "",
      t.is_active !== false ? "Active" : "Inactive",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teachers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "10px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Teachers</h1>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/admin/custom-fields" className="btn btn-outline">Manage Extra Fields</Link>
          <Link href="/admin/teachers/new" className="btn btn-primary">Add Teacher</Link>
        </div>
      </div>

      <div className="portal-panel">
        <div className="filter-bar" style={{ justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search by name&hellip;"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ minWidth: "200px" }}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="btn btn-outline" onClick={exportToCsv}>Export to CSV</button>
        </div>

        {filtered.length === 0 ? <p>No teachers match this view.</p> : (
          <table className="data-table">
            <thead><tr><th></th><th>Name</th><th>Employee No.</th><th>Designation</th><th>BPS</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((t) => {
                const isActive = t.is_active !== false;
                return (
                  <tr key={t.id}>
                    <td>
                      {photoUrls[t.id] ? (
                        <img src={photoUrls[t.id]} alt={t.full_name} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                      ) : (
                        <div style={{ width: "32px", height: "32px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "4px" }} />
                      )}
                    </td>
                    <td>{t.full_name}</td>
                    <td>{t.employee_number || "\u2014"}</td>
                    <td>{t.designation || t.subject || "\u2014"}</td>
                    <td>{t.bps_grade || "\u2014"}</td>
                    <td><span className={`pill ${isActive ? "pill-green" : "pill-red"}`}>{t.status || (isActive ? "Active" : "Inactive")}</span></td>
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
