"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function ClassesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadClasses() {
    const { data } = await supabase.from("classes").select("*").order("grade");
    setClasses(data || []);
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
      await loadClasses();
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-class", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ grade, section }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Class ${grade}-${section} created.` });
      setGrade("");
      setSection("");
      await loadClasses();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
      <AdminLayout active="classes" fullName={fullName}>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Classes</h1>

        <div className="portal-panel" style={{ maxWidth: "420px" }}>
          <h2>Add a Class</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="grade">Grade</label>
              <input id="grade" required placeholder="e.g. 9" value={grade} onChange={(e) => setGrade(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="section">Section</label>
              <input id="section" required placeholder="e.g. A" value={section} onChange={(e) => setSection(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add Class"}
            </button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
          </form>
        </div>

        <div className="portal-panel">
          <h2>All Classes</h2>
          {classes.length === 0 ? <p>No classes yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Grade</th><th>Section</th></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}><td>{c.grade}</td><td>{c.section}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </AdminLayout>
  );
}
