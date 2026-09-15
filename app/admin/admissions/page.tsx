"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const STATUS_OPTIONS = ["new", "under_review", "approved", "rejected", "enrolled"];

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
  const [admissions, setAdmissions] = useState<any[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function loadAdmissions() {
    const { data } = await supabase.from("admissions").select("*").order("created_at", { ascending: false });
    setAdmissions(data || []);
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
      await loadAdmissions();
      setLoading(false);
    })();
  }, [router]);

  async function updateStatus(admissionId: string, status: string) {
    setUpdatingId(admissionId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/update-admission-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ admission_id: admissionId, status }),
    });

    await loadAdmissions();
    setUpdatingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const newCount = admissions.filter((a) => a.status === "new").length;

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Admissions</h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        Inquiries submitted through the public website's admissions form appear here automatically.
      </p>

      <div className="portal-cards" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "420px" }}>
        <div className="icon-stat-card">
          <div className="icon-stat-num">{admissions.length}</div>
          <div className="icon-stat-label">Total inquiries</div>
        </div>
        <div className="icon-stat-card">
          <div className="icon-stat-num">{newCount}</div>
          <div className="icon-stat-label">Awaiting review</div>
        </div>
      </div>

      <div className="portal-panel">
        {admissions.length === 0 ? (
          <p>No admission inquiries yet. Once someone submits the form on the public website, it will appear here.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Student</th><th>Parent</th><th>Phone</th><th>Grade</th><th>Status</th></tr></thead>
            <tbody>
              {admissions.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.created_at).toLocaleDateString()}</td>
                  <td>{a.student_name}</td>
                  <td>{a.parent_name}</td>
                  <td>{a.phone}</td>
                  <td>{a.grade_applying || "\u2014"}</td>
                  <td>
                    <select
                      value={a.status}
                      disabled={updatingId === a.id}
                      onChange={(e) => updateStatus(a.id, e.target.value)}
                      style={{ width: "auto", padding: "5px 8px", fontSize: "0.82rem" }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    <span className={`pill ${STATUS_PILL[a.status]}`} style={{ marginLeft: "8px" }}>{STATUS_LABELS[a.status]}</span>
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
