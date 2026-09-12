"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function NewFeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [students, setStudents] = useState<any[]>([]);

  const [studentId, setStudentId] = useState("");
  const [chargeName, setChargeName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("unpaid");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

      const { data: studentData } = await supabase.from("students").select("*, classes(name)").order("full_name");
      setStudents(studentData || []);
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-fee", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ student_id: studentId, charge_name: chargeName, amount, status, due_date: dueDate || null }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Fee record added." });
      setChargeName("");
      setAmount("");
      setStatus("unpaid");
      setDueDate("");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
      <AdminLayout active="fees" fullName={fullName}>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Add a Fee Record</h1>

        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="student_id">Student</label>
              <select id="student_id" required value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Select a student&hellip;</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name} ({s.classes?.name || "no class"})</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="charge_name">Charge name</label>
              <input id="charge_name" required placeholder="e.g. School Fund" value={chargeName} onChange={(e) => setChargeName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="amount">Amount (PKR)</label>
              <input id="amount" type="number" required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="status">Status</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="due_date">Due date (optional)</label>
              <input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add Fee Record"}
            </button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
          </form>
        </div>
      </AdminLayout>
  );
}
