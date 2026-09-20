"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const HOUSES = ["Iqbal", "Jinnah", "Liaquat", "Fatima"];

export default function HousesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<any[]>([]);

  const [house, setHouse] = useState(HOUSES[0]);
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadData() {
    const [{ data: students }, { data: pointsData }] = await Promise.all([
      supabase.from("students").select("house"),
      supabase.from("house_points").select("*").order("created_at", { ascending: false }),
    ]);

    const counts: Record<string, number> = {};
    HOUSES.forEach((h) => (counts[h] = 0));
    (students || []).forEach((s) => {
      if (s.house && counts[s.house] !== undefined) counts[s.house] += 1;
    });
    setStudentCounts(counts);

    const totalsMap: Record<string, number> = {};
    HOUSES.forEach((h) => (totalsMap[h] = 0));
    (pointsData || []).forEach((p) => {
      if (totalsMap[p.house] !== undefined) totalsMap[p.house] += p.points;
    });
    setTotals(totalsMap);
    setHistory((pointsData || []).slice(0, 15));
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
      await loadData();
      setLoading(false);
    })();
  }, [router]);

  async function handleAddPoints(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/add-house-points", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ house, points, reason }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${points} points recorded for ${house}.` });
      setPoints("");
      setReason("");
      await loadData();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const ranked = [...HOUSES].sort((a, b) => totals[b] - totals[a]);

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Houses</h1>

      <div className="portal-cards" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {ranked.map((h, i) => (
          <div className="icon-stat-card" key={h}>
            <div className="icon-stat-num">{totals[h]} pts</div>
            <div className="icon-stat-label">{h} House {i === 0 && totals[h] > 0 ? "\u2014 Leading" : ""} &middot; {studentCounts[h]} students</div>
          </div>
        ))}
      </div>

      <div className="portal-panel" style={{ maxWidth: "460px" }}>
        <h2>Award or Deduct Points</h2>
        <form onSubmit={handleAddPoints}>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="house">House</label>
              <select id="house" value={house} onChange={(e) => setHouse(e.target.value)}>
                {HOUSES.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="points">Points (use negative to deduct)</label>
              <input id="points" type="number" required value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="reason">Reason</label>
            <input id="reason" placeholder="e.g. Won inter-house football match" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Record Points"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>Recent Point History</h2>
        {history.length === 0 ? <p>No points recorded yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>House</th><th>Points</th><th>Reason</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleDateString()}</td>
                  <td>{h.house}</td>
                  <td>{h.points > 0 ? `+${h.points}` : h.points}</td>
                  <td>{h.reason || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
