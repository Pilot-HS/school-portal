"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  parent: "Parent",
  teacher: "Teacher",
  admin: "Admin",
};

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [logins, setLogins] = useState<any[]>([]);
  const [loginsError, setLoginsError] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadLogins() {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/admin/list-logins", { headers: { Authorization: `Bearer ${token}` } });
    const result = await res.json();
    if (!res.ok) {
      setLoginsError(result.error || "Couldn't load the list of logins.");
    } else {
      setLoginsError("");
      setLogins(result.logins || []);
    }
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
      await loadLogins();
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
      setMessage({ type: "success", text: `Login created for ${newFullName} (${ROLE_LABELS[newRole]}). Next, link it to their record — see the note above.` });
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("student");
      await loadLogins();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const visibleLogins = logins.filter((l) => roleFilter === "all" || l.role === roleFilter);

  return (
    <AdminLayout active="accounts" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Accounts</h1>
      <p style={{ color: "var(--muted)", marginBottom: "24px", maxWidth: "720px" }}>
        This page creates <strong>logins</strong> (an email and password with a role). A login does not appear under Students or Teachers until it is linked to a record:
        for a teacher, pick it under &ldquo;Portal Account&rdquo; when you{" "}
        <Link href="/admin/teachers/new" style={{ color: "var(--accent-2)" }}>add</Link> or edit a teacher; for a student or parent, pick it when you{" "}
        <Link href="/admin/students/new" style={{ color: "var(--accent-2)" }}>add</Link> or edit a student.
      </p>

      <div className="portal-panel" style={{ maxWidth: "480px" }}>
        <h2>Create New Login</h2>
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
            {submitting ? "Creating…" : "Create Login"}
          </button>
          {message && (
            <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>
          )}
        </form>
      </div>

      <div className="portal-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
          <h2 style={{ margin: 0 }}>All Logins ({visibleLogins.length})</h2>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: "auto", padding: "6px 10px" }}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </select>
        </div>
        {loginsError && <p className="error-text">{loginsError}</p>}
        {visibleLogins.length === 0 ? (
          <p>No logins to show.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Linked to</th></tr></thead>
            <tbody>
              {visibleLogins.map((l) => (
                <tr key={l.id}>
                  <td>{l.full_name}</td>
                  <td>{l.email || "\u2014"}</td>
                  <td>{ROLE_LABELS[l.role] || l.role}</td>
                  <td>
                    {l.role === "admin" ? (
                      <span style={{ color: "var(--muted)" }}>&mdash;</span>
                    ) : l.linked_to ? (
                      l.linked_to
                    ) : (
                      <span className="pill pill-amber">Not linked yet</span>
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
