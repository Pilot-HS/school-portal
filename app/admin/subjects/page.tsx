"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function SubjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadSubjects() {
    const { data } = await supabase.from("subjects").select("*").order("name");
    setSubjects(data || []);
  }

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.replace("/login"); return; }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") { router.replace(profile?.role ? `/${profile.role}` : "/login"); return; }
      setFullName(profile.full_name);
      await loadSubjects();
      setLoading(false);
    })();
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/create-subject", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    const result = await res.json();
    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${name} added.` });
      setName("");
      await loadSubjects();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="exams" fullName={fullName}>
      <Link href="/admin/exams" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Exams &amp; Results</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Subjects</h1>

      <div className="portal-panel" style={{ maxWidth: "380px" }}>
        <h2>Add a Subject</h2>
        <form onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="name">Subject name</label>
            <input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mathematics" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Subject"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>All Subjects</h2>
        {subjects.length === 0 ? <p>No subjects added yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th></tr></thead>
            <tbody>
              {subjects.map((s) => <tr key={s.id}><td>{s.name}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
