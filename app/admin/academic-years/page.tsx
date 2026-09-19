"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function AcademicYearsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [years, setYears] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [setCurrent, setSetCurrent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadYears() {
    const { data } = await supabase.from("academic_years").select("*").order("label", { ascending: false });
    setYears(data || []);
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
      await loadYears();
      setLoading(false);
    })();
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-academic-year", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label, set_as_current: setCurrent }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${label} added.` });
      setLabel("");
      setSetCurrent(true);
      await loadYears();
    }
    setSubmitting(false);
  }

  async function handleSetCurrent(id: string) {
    setSwitchingId(id);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/set-current-academic-year", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ academic_year_id: id }),
    });

    await loadYears();
    setSwitchingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <Link href="/admin/admissions" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Admissions</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Academic Years</h1>

      <div className="portal-panel" style={{ maxWidth: "420px" }}>
        <h2>Add a New Academic Year</h2>
        <form onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="label">Label</label>
            <input id="label" required placeholder="e.g. 2026-2027" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400, marginBottom: "16px" }}>
            <input type="checkbox" checked={setCurrent} onChange={(e) => setSetCurrent(e.target.checked)} style={{ width: "auto" }} />
            Set as the current session
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Academic Year"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>All Academic Years</h2>
        {years.length === 0 ? <p>No academic years added yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Label</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {years.map((y) => (
                <tr key={y.id}>
                  <td>{y.label}</td>
                  <td>{y.is_current ? <span className="pill pill-green">Current</span> : <span style={{ color: "var(--muted)" }}>&mdash;</span>}</td>
                  <td>
                    {!y.is_current && (
                      <button
                        className="btn btn-outline"
                        style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                        disabled={switchingId === y.id}
                        onClick={() => handleSetCurrent(y.id)}
                      >
                        {switchingId === y.id ? "…" : "Set as Current"}
                      </button>
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
