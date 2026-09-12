"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function FeesListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [fees, setFees] = useState<any[]>([]);
  const [togglingFeeId, setTogglingFeeId] = useState<string | null>(null);

  async function loadFees() {
    const { data } = await supabase.from("fees").select("*, students(full_name)").order("id", { ascending: false });
    setFees(data || []);
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
      await loadFees();
      setLoading(false);
    })();
  }, [router]);

  async function toggleFeeStatus(feeId: string, currentStatus: string) {
    setTogglingFeeId(feeId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const newStatus = currentStatus === "paid" ? "unpaid" : "paid";

    await fetch("/api/admin/update-fee-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fee_id: feeId, status: newStatus }),
    });

    await loadFees();
    setTogglingFeeId(null);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="fees" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Fees</h1>
        <Link href="/admin/fees/new" className="btn btn-primary">Add Fee Record</Link>
      </div>

      <div className="portal-panel">
        {fees.length === 0 ? <p>No fee records yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Student</th><th>Charge</th><th>Amount</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td>{f.students?.full_name}</td>
                  <td>{f.charge_name}</td>
                  <td>PKR {f.amount}</td>
                  <td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td>
                  <td>
                    <button
                      className="btn btn-outline"
                      style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                      disabled={togglingFeeId === f.id}
                      onClick={() => toggleFeeStatus(f.id, f.status)}
                    >
                      {togglingFeeId === f.id ? "…" : f.status === "paid" ? "Mark unpaid" : "Mark paid"}
                    </button>
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
