"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");

  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("student");
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
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        full_name: newFullName,
        role: newRole,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Account created for ${newFullName} (${newRole}).` });
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("student");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="portal-main">
        <Link href="/admin" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Dashboard</Link>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Create New Account</h1>
        <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
          This creates a real login. After creating a student or teacher account, link it to a student/teacher record via the Supabase Table Editor (set the profile_id column).
        </p>

        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="full_name">Full name</label>
              <input id="full_name" required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="password">Temporary password</label>
              <input id="password" type="text" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="role">Role</label>
              <select id="role" value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create Account"}
            </button>
            {message && (
              <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
