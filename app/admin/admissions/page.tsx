"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

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

export default function AdmissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [applications, setApplications] = useState<any[]>([]);

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
        .select("*")
        .order("created_at", { ascending: false });
      setApplications(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const newCount = applications.filter((a) => a.status === "new").length;

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Admissions</h1>
        <Link href="/admin/admissions/new" className="btn btn-primary">Add Application</Link>
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

      <div className="portal-panel">
        {applications.length === 0 ? (
          <p>No applications yet.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Student</th><th>Father's Name</th><th>Class Applying</th><th>Contact</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {applications.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>{a.student_full_name}</td>
                  <td>{a.father_name || "\u2014"}</td>
                  <td>{a.class_applying_for || "\u2014"}</td>
                  <td>{a.parent_contact}</td>
                  <td><span className={`pill ${STATUS_PILL[a.status]}`}>{STATUS_LABELS[a.status]}</span></td>
                  <td><Link href={`/admin/admissions/${a.id}`} className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
