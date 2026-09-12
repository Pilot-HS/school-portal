"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function EditStudentPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [studentLogins, setStudentLogins] = useState<any[]>([]);
  const [parentLogins, setParentLogins] = useState<any[]>([]);

  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [classId, setClassId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [parentProfileId, setParentProfileId] = useState("");
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

      const [{ data: studentRow }, { data: classData }, { data: studentProfiles }, { data: parentProfiles }] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId).single(),
        supabase.from("classes").select("*").order("grade"),
        supabase.from("profiles").select("id, full_name").eq("role", "student"),
        supabase.from("profiles").select("id, full_name").eq("role", "parent"),
      ]);

      if (studentRow) {
        setStudentName(studentRow.full_name);
        setRollNo(studentRow.roll_no);
        setClassId(studentRow.class_id || "");
        setProfileId(studentRow.profile_id || "");
        setParentProfileId(studentRow.parent_profile_id || "");
      }
      setClasses(classData || []);
      setStudentLogins(studentProfiles || []);
      setParentLogins(parentProfiles || []);
      setLoading(false);
    })();
  }, [router, studentId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/update-student", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        student_id: studentId,
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
      setMessage({ type: "success", text: "Student updated." });
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Edit Student</h1>

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
            <label htmlFor="profile_id">Linked student login</label>
            <select id="profile_id" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
              <option value="">No login linked</option>
              {studentLogins.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="parent_profile_id">Linked parent login</label>
            <select id="parent_profile_id" value={parentProfileId} onChange={(e) => setParentProfileId(e.target.value)}>
              <option value="">No parent login linked</option>
              {parentLogins.map((p) => (
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
