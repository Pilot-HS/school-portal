"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [unlinkedStudentLogins, setUnlinkedStudentLogins] = useState<any[]>([]);
  const [unlinkedParentLogins, setUnlinkedParentLogins] = useState<any[]>([]);

  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [classId, setClassId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [parentProfileId, setParentProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadDropdownData() {
    const [{ data: classData }, { data: studentProfiles }, { data: parentProfiles }, { data: existingStudents }] = await Promise.all([
      supabase.from("classes").select("*").order("grade"),
      supabase.from("profiles").select("id, full_name").eq("role", "student"),
      supabase.from("profiles").select("id, full_name").eq("role", "parent"),
      supabase.from("students").select("profile_id, parent_profile_id"),
    ]);

    setClasses(classData || []);

    const linkedStudentIds = new Set((existingStudents || []).map((s) => s.profile_id).filter(Boolean));
    setUnlinkedStudentLogins((studentProfiles || []).filter((p) => !linkedStudentIds.has(p.id)));

    // A parent can have more than one child, so don't filter parents out once used
    setUnlinkedParentLogins(parentProfiles || []);
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

    const res = await fetch("/api/admin/create-student", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        full_name: studentName,
        roll_no: rollNo,
        class_id: classId,
        profile_id: profileId || null,
        parent_profile_id: parentProfileId || null,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${studentName} added.` });
      setStudentName("");
      setRollNo("");
      setClassId("");
      setProfileId("");
      setParentProfileId("");
      await loadDropdownData();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="portal-main">
        <Link href="/admin" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Dashboard</Link>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Add a Student</h1>

        {classes.length === 0 && (
          <div className="portal-panel" style={{ borderColor: "#c9992e" }}>
            <p style={{ margin: 0 }}>
              No classes exist yet. <Link href="/admin/classes" style={{ color: "var(--accent-2)", fontWeight: 600 }}>Add a class first</Link>, then come back here.
            </p>
          </div>
        )}

        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="student_name">Student's full name</label>
              <input id="student_name" required value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="roll_no">Roll number</label>
              <input id="roll_no" required value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="class_id">Class</label>
              <select id="class_id" required value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class&hellip;</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="profile_id">Link to a student login (optional)</label>
              <select id="profile_id" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                <option value="">No login yet / skip</option>
                {unlinkedStudentLogins.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="parent_profile_id">Link to a parent login (optional)</label>
              <select id="parent_profile_id" value={parentProfileId} onChange={(e) => setParentProfileId(e.target.value)}>
                <option value="">No parent login yet / skip</option>
                {unlinkedParentLogins.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting || classes.length === 0}>
              {submitting ? "Adding…" : "Add Student"}
            </button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
          </form>
        </div>

        <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "480px" }}>
          Tip: create the student's (and parent's) login first from <Link href="/admin/create-user" style={{ color: "var(--accent-2)" }}>Create New Account</Link>, then come back here to link them — or add the student first and link the login later by editing this record.
        </p>
      </div>
    </div>
  );
}
