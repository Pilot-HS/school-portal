"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { formatApplicationId } from "@/lib/applicationId";

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  enrolled: "Enrolled",
};

const STATUS_PILL: Record<string, string> = {
  new: "pill-amber",
  under_review: "pill-amber",
  approved: "pill-green",
  rejected: "pill-red",
  enrolled: "pill-green",
};

type SubTab = "all" | "pending" | "approved";

export default function AdmissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [applications, setApplications] = useState<any[]>([]);
  const [subTab, setSubTab] = useState<SubTab>("all");

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
        .from("admission_applications")
        .select("*, academic_years(label)")
        .order("created_at", { ascending: false });
      setApplications(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const newCount = applications.filter((a) => a.status === "new").length;

  const filtered = applications.filter((a) => {
    if (subTab === "all") return true;
    if (subTab === "pending") return a.status === "new" || a.status === "under_review";
    if (subTab === "approved") return a.status === "approved" || a.status === "enrolled";
    return true;
  });

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Admissions</h1>
        <div style={{ display: "flex", gap: "10px" }}>
          <Link href="/admin/academic-years" className="btn btn-outline">Manage Academic Years</Link>
          <Link href="/admin/admissions/new" className="btn btn-primary">Add Application</Link>
        </div>
      </div>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        Applications submitted through the public website, or entered here by office staff for walk-in families.
      </p>

      <div className="portal-cards" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "420px" }}>
        <div className="icon-stat-card">
          <div className="icon-stat-num">{applications.length}</div>
          <div className="icon-stat-label">Total applications</div>
        </div>
        <div className="icon-stat-card">
          <div className="icon-stat-num">{newCount}</div>
          <div className="icon-stat-label">Awaiting review</div>
        </div>
      </div>

      <div className="sub-tabs">
        <button className={subTab === "all" ? "active" : ""} onClick={() => setSubTab("all")}>All Applications</button>
        <button className={subTab === "pending" ? "active" : ""} onClick={() => setSubTab("pending")}>Pending Review</button>
        <button className={subTab === "approved" ? "active" : ""} onClick={() => setSubTab("approved")}>Approved &amp; Enrolled</button>
      </div>

      <div className="portal-panel">
        {filtered.length === 0 ? (
          <p>No applications in this view.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Reference ID</th><th>Date</th><th>Student</th><th>Father's Name</th><th>Class Applying</th><th>Academic Year</th><th>Contact</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: "monospace", fontSize: "0.82rem" }}>{formatApplicationId(a.application_seq, a.created_at)}</td>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>{a.student_full_name}</td>
                  <td>{a.father_name || "\u2014"}</td>
                  <td>{a.class_applying_for || "\u2014"}</td>
                  <td>{a.academic_years?.label || "\u2014"}</td>
                  <td>{a.parent_contact}</td>
                  <td><span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    <Link href={`/admin/admissions/${a.id}`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>View</Link>
                    {a.status === "approved" && !a.converted_student_id && (
                      <Link href={`/admin/admissions/${a.id}/convert`} className="btn btn-primary" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>Convert to Student</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
