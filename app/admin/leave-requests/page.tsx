"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const STATUS_PILL: Record<string, string> = {
  pending: "pill-amber",
  approved: "pill-green",
  rejected: "pill-red",
};

export default function LeaveRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function loadRequests() {
    const { data } = await supabase
      .from("leave_requests")
      .select("*, teachers(full_name)")
      .order("created_at", { ascending: false });
    setRequests(data || []);
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
      await loadRequests();
      setLoading(false);
    })();
  }, [router]);

  async function decide(requestId: string, decision: "approved" | "rejected") {
    setDecidingId(requestId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/review-leave-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId, decision }),
    });

    await loadRequests();
    setDecidingId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <Link href="/admin/teachers" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Teachers</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Leave Requests</h1>

      <div className="portal-panel">
        <h2>Pending ({pending.length})</h2>
        {pending.length === 0 ? <p>No pending requests.</p> : (
          <table className="data-table">
            <thead><tr><th>Teacher</th><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.teachers?.full_name}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td>{r.reason || "\u2014"}</td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: "0.78rem" }} disabled={decidingId === r.id} onClick={() => decide(r.id, "approved")}>
                      {decidingId === r.id ? "…" : "Approve"}
                    </button>
                    <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }} disabled={decidingId === r.id} onClick={() => decide(r.id, "rejected")}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="portal-panel">
        <h2>Decided</h2>
        {decided.length === 0 ? <p>No decided requests yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Teacher</th><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              {decided.map((r) => (
                <tr key={r.id}>
                  <td>{r.teachers?.full_name}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td>{r.reason || "\u2014"}</td>
                  <td><span className={`pill ${STATUS_PILL[r.status]}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
