"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function EditTeacherPage() {
  const router = useRouter();
  const params = useParams();
  const teacherId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [teacherLogins, setTeacherLogins] = useState<any[]>([]);

  const [teacherName, setTeacherName] = useState("");
  const [subject, setSubject] = useState("");
  const [profileId, setProfileId] = useState("");
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

      const [{ data: teacherRow }, { data: teacherProfiles }] = await Promise.all([
        supabase.from("teachers").select("*").eq("id", teacherId).single(),
        supabase.from("profiles").select("id, full_name").eq("role", "teacher"),
      ]);

      if (teacherRow) {
        setTeacherName(teacherRow.full_name);
        setSubject(teacherRow.subject || "");
        setProfileId(teacherRow.profile_id || "");
      }
      setTeacherLogins(teacherProfiles || []);
      setLoading(false);
    })();
  }, [router, teacherId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/update-teacher", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ teacher_id: teacherId, full_name: teacherName, subject, profile_id: profileId || null }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Teacher updated." });
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <Link href="/admin/teachers" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Teachers</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Edit Teacher</h1>

      <div className="portal-panel" style={{ maxWidth: "480px" }}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="teacher_name">Teacher's full name</label>
            <input id="teacher_name" required value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="profile_id">Linked teacher login</label>
            <select id="profile_id" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">No login linked</option>
              {teacherLogins.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>
    </AdminLayout>
  );
}
