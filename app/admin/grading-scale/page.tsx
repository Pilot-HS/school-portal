"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function GradingScalePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [scale, setScale] = useState<any>(null);
  const [bands, setBands] = useState<any[]>([]);

  const [gradeLabel, setGradeLabel] = useState("");
  const [minPercentage, setMinPercentage] = useState("");
  const [maxPercentage, setMaxPercentage] = useState("");
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadBands(scaleId: string) {
    const { data } = await supabase.from("grade_bands").select("*").eq("grading_scale_id", scaleId).order("min_percentage", { ascending: false });
    setBands(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") { router.replace(profile?.role ? `/${profile.role}` : "/login"); return; }
      setFullName(profile.full_name);
      const { data: activeScale } = await supabase.from("grading_scales").select("*").eq("is_active", true).maybeSingle();
      setScale(activeScale);
      if (activeScale) await loadBands(activeScale.id);
      setLoading(false);
    })();
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/create-grade-band", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ grade_label: gradeLabel, min_percentage: minPercentage, max_percentage: maxPercentage, remarks }),
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Grade ${gradeLabel} added.` });
      setGradeLabel(""); setMinPercentage(""); setMaxPercentage(""); setRemarks("");
      if (scale) await loadBands(scale.id);
    }
    setSubmitting(false);
  }

  async function handleDelete(bandId: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch("/api/admin/delete-grade-band", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ band_id: bandId }),
    });
    if (scale) await loadBands(scale.id);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="exams" fullName={fullName}>
      <Link href="/admin/exams" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Exams &amp; Results</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "4px" }}>Grading Scale</h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>{scale ? `Active scale: ${scale.name}` : "No active grading scale found."}</p>

      {scale && (
        <>
          <div className="portal-panel" style={{ maxWidth: "480px" }}>
            <h2>Add a Grade Band</h2>
            <form onSubmit={handleAdd}>
              <div className="form-grid">
                <div className="form-field"><label htmlFor="grade_label">Grade label</label><input id="grade_label" required value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} placeholder="e.g. A1" /></div>
                <div className="form-field"><label htmlFor="min_percentage">Min %</label><input id="min_percentage" type="number" step="0.01" required value={minPercentage} onChange={(e) => setMinPercentage(e.target.value)} /></div>
                <div className="form-field"><label htmlFor="max_percentage">Max %</label><input id="max_percentage" type="number" step="0.01" required value={maxPercentage} onChange={(e) => setMaxPercentage(e.target.value)} /></div>
                <div className="form-field"><label htmlFor="remarks">Remarks</label><input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Excellent" /></div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Adding…" : "Add Grade Band"}</button>
              {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
            </form>
          </div>

          <div className="portal-panel">
            <h2>Current Grade Bands</h2>
            {bands.length === 0 ? <p>No grade bands set up yet.</p> : (
              <table className="data-table">
                <thead><tr><th>Grade</th><th>Range</th><th>Remarks</th><th></th></tr></thead>
                <tbody>
                  {bands.map((b) => (
                    <tr key={b.id}>
                      <td>{b.grade_label}</td>
                      <td>{b.min_percentage}% &ndash; {b.max_percentage}%</td>
                      <td>{b.remarks || "\u2014"}</td>
                      <td><button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem", color: "#a13636" }} onClick={() => handleDelete(b.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
