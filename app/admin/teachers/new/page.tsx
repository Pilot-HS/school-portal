"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function NewTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [unlinkedTeacherLogins, setUnlinkedTeacherLogins] = useState<any[]>([]);

  const [teacherName, setTeacherName] = useState("");
  const [subject, setSubject] = useState("");
  const [profileId, setProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadDropdownData() {
    const [{ data: teacherProfiles }, { data: existingTeachers }] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
      supabase.from("teachers").select("profile_id"),
    ]);
    const linkedIds = new Set((existingTeachers || []).map((t) => t.profile_id).filter(Boolean));
    setUnlinkedTeacherLogins((teacherProfiles || []).filter((p) => !linkedIds.has(p.id)));
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
      await loadDropdownData();
      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        full_name: teacherName,
        subject,
        profile_id: profileId || null,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${teacherName} added.` });
      setTeacherName("");
      setSubject("");
      setProfileId("");
      await loadDropdownData();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
      <AdminLayout active="teachers" fullName={fullName}>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Add a Teacher</h1>

        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="teacher_name">Teacher's full name</label>
              <input id="teacher_name" required value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="subject">Subject</label>
              <input id="subject" placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="profile_id">Link to a teacher login (optional)</label>
              <select id="profile_id" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                <option value="">No login yet / skip</option>
                {unlinkedTeacherLogins.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add Teacher"}
            </button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
          </form>
        </div>

        <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "480px" }}>
          Tip: create the teacher's login first from <Link href="/admin/create-user" style={{ color: "var(--accent-2)" }}>Create New Account</Link>, then come back here to link them.
        </p>
      </AdminLayout>
  );
}
