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
  const [classes, setClasses] = useState<any[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadStudents(token: string) {
    const { data } = await supabase.from("students").select("*, classes(name)").order("full_name");
    setStudents(data || []);

    // Fetch signed URLs for any students with a photo, in parallel
    const withPhotos = (data || []).filter((s) => s.photo_path);
    const urls: Record<string, string> = {};
    await Promise.all(
      withPhotos.map(async (s) => {
        const res = await fetch("/api/admin/get-signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: s.photo_path }),
        });
        const result = await res.json();
        if (res.ok) urls[s.id] = result.url;
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

      const { data: classData } = await supabase.from("classes").select("*").order("grade");
      setClasses(classData || []);

      await loadStudents(session.access_token);
      setLoading(false);
    })();
  }, [router]);

  async function toggleActive(studentId: string, currentActive: boolean) {
    let reason: string | null = null;
    if (currentActive) {
      reason = window.prompt("Reason for deactivating (e.g. 'Transferred to another school'). Leave blank to skip:");
      if (reason === null) return; // user cancelled
    }
    setTogglingId(studentId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/toggle-student-active", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_id: studentId, is_active: !currentActive, reason: reason || undefined }),
    });

    await loadStudents(token!);
    setTogglingId(null);
  }

  function exportToCsv() {
    const headers = ["Name", "GR Number", "Roll No", "Class", "House", "Status"];
    const rows = filtered.map((s) => [
      s.full_name,
      s.gr_number || "",
      s.roll_no,
      s.classes?.name || "",
      s.house || "",
      s.is_active !== false ? "Active" : "Inactive",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const filtered = students.filter((s) => {
    const isActive = s.is_active !== false;
    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "inactive" && isActive) return false;
    if (classFilter !== "all" && s.class_id !== classFilter) return false;
    if (searchText && !s.full_name.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  return (
    <AdminLayout active="students" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Students</h1>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link href="/admin/academic-years" className="btn btn-outline">Manage Academic Years</Link>
          <Link href="/admin/custom-fields" className="btn btn-outline">Manage Extra Fields</Link>
          <Link href="/admin/houses" className="btn btn-outline">Houses</Link>
          <Link href="/admin/students/birthdays" className="btn btn-outline">Birthdays</Link>
          <Link href="/admin/students/promote" className="btn btn-outline">Promote Students</Link>
          <Link href="/admin/students/new" className="btn btn-primary">Add Student</Link>
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
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="all">All Classes</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <button className="btn btn-outline" onClick={exportToCsv}>Export to CSV</button>
        </div>

        {filtered.length === 0 ? <p>No students match this view.</p> : (
          <table className="data-table">
            <thead><tr><th></th><th>Name</th><th>GR No.</th><th>Roll No.</th><th>Class</th><th>House</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((s) => {
                const isActive = s.is_active !== false;
                return (
                  <tr key={s.id}>
                    <td>
                      {photoUrls[s.id] ? (
                        <img src={photoUrls[s.id]} alt={s.full_name} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                      ) : (
                        <div style={{ width: "32px", height: "32px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "4px" }} />
                      )}
                    </td>
                    <td>{s.full_name}</td>
                    <td>{s.gr_number || "\u2014"}</td>
                    <td>{s.roll_no}</td>
                    <td>{s.classes?.name || "\u2014"}</td>
                    <td>{s.house || "\u2014"}</td>
                    <td><span className={`pill ${isActive ? "pill-green" : "pill-red"}`}>{isActive ? "Active" : "Inactive"}</span></td>
                    <td style={{ display: "flex", gap: "6px" }}>
                      <Link href={`/admin/students/${s.id}/edit`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>Edit</Link>
                      <Link href={`/admin/students/${s.id}/id-card`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>ID Card</Link>
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
