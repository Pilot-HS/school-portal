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
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [studentLogins, setStudentLogins] = useState<any[]>([]);
  const [parentLogins, setParentLogins] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");

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

      const [{ data: studentRow }, { data: classData }, { data: studentProfiles }, { data: parentProfiles }, { data: years }] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId).single(),
        supabase.from("classes").select("*").order("grade"),
        supabase.from("profiles").select("id, full_name").eq("role", "student"),
        supabase.from("profiles").select("id, full_name").eq("role", "parent"),
        supabase.from("academic_years").select("*").order("label", { ascending: false }),
      ]);

      if (studentRow) {
        setStudent(studentRow);
        if (studentRow.photo_path) {
          const token = session.access_token;
          const res = await fetch("/api/admin/get-signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: studentRow.photo_path }),
          });
          const result = await res.json();
          if (res.ok) setPhotoUrl(result.url);
        }
      }
      setClasses(classData || []);
      setAcademicYears(years || []);
      setStudentLogins(studentProfiles || []);
      setParentLogins(parentProfiles || []);
      setLoading(false);
    })();
  }, [router, studentId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("student_id", studentId);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/update-student", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
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
  if (!student) return <AdminLayout active="students" fullName={fullName}><p>Student not found.</p></AdminLayout>;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Edit Student</h1>

      <div className="portal-panel" style={{ maxWidth: "480px" }}>
        <form onSubmit={handleSubmit}>
          {photoUrl && (
            <div className="form-field">
              <img src={photoUrl} alt={student.full_name} style={{ width: "100px", height: "100px", objectFit: "cover", border: "1px solid var(--border)" }} />
            </div>
          )}
          <div className="form-field">
            <label htmlFor="full_name">Student's full name</label>
            <input id="full_name" name="full_name" required defaultValue={student.full_name} />
          </div>
          <div className="form-field">
            <label htmlFor="roll_no">Roll number</label>
            <input id="roll_no" name="roll_no" required defaultValue={student.roll_no} />
          </div>
          <div className="form-field">
            <label htmlFor="gr_number">GR Number</label>
            <input id="gr_number" name="gr_number" defaultValue={student.gr_number || ""} />
          </div>
          <div className="form-field">
            <label htmlFor="date_of_birth">Date of birth</label>
            <input id="date_of_birth" name="date_of_birth" type="date" defaultValue={student.date_of_birth || ""} />
          </div>
          <div className="form-field">
            <label htmlFor="photo">Replace photograph (optional)</label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
          </div>
          <div className="form-field">
            <label htmlFor="class_id">Class</label>
            <select id="class_id" name="class_id" required defaultValue={student.class_id || ""}>
              <option value="">Select a class&hellip;</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="academic_year_id">Academic year</label>
            <select id="academic_year_id" name="academic_year_id" defaultValue={student.academic_year_id || ""}>
              <option value="">Select&hellip;</option>
              {academicYears.map((y: any) => (
                <option key={y.id} value={y.id}>{y.label}{y.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="profile_id">Linked student login</label>
            <select id="profile_id" name="profile_id" defaultValue={student.profile_id || ""}>
              <option value="">No login linked</option>
              {studentLogins.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="parent_profile_id">Linked parent login</label>
            <select id="parent_profile_id" name="parent_profile_id" defaultValue={student.parent_profile_id || ""}>
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
