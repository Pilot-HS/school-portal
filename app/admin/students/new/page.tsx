"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import CustomFieldInputs from "@/components/CustomFieldInputs";

export default function NewStudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [unlinkedStudentLogins, setUnlinkedStudentLogins] = useState<any[]>([]);
  const [unlinkedParentLogins, setUnlinkedParentLogins] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [defaultAcademicYearId, setDefaultAcademicYearId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadDropdownData() {
    const [{ data: classData }, { data: studentProfiles }, { data: parentProfiles }, { data: existingStudents }, { data: years }] = await Promise.all([
      supabase.from("classes").select("*").order("grade"),
      supabase.from("profiles").select("id, full_name").eq("role", "student"),
      supabase.from("profiles").select("id, full_name").eq("role", "parent"),
      supabase.from("students").select("profile_id, parent_profile_id"),
      supabase.from("academic_years").select("*").order("label", { ascending: false }),
    ]);

    setClasses(classData || []);
    setAcademicYears(years || []);
    const current = (years || []).find((y: any) => y.is_current);
    if (current) setDefaultAcademicYearId(current.id);

    const linkedStudentIds = new Set((existingStudents || []).map((s) => s.profile_id).filter(Boolean));
    setUnlinkedStudentLogins((studentProfiles || []).filter((p) => !linkedStudentIds.has(p.id)));
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

      const { data: fields } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("form_type", "student")
        .eq("is_active", true)
        .order("display_order");
      setCustomFields(fields || []);

      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const studentName = formData.get("full_name") as string;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-student", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `${studentName} added.` });
      form.reset();
      await loadDropdownData();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="students" fullName={fullName}>
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
            <label htmlFor="full_name">Student's full name</label>
            <input id="full_name" name="full_name" required />
          </div>
          <div className="form-field">
            <label htmlFor="roll_no">Roll number</label>
            <input id="roll_no" name="roll_no" required />
          </div>
          <div className="form-field">
            <label htmlFor="gr_number">GR Number (optional)</label>
            <input id="gr_number" name="gr_number" />
          </div>
          <div className="form-field">
            <label htmlFor="date_of_birth">Date of birth (optional)</label>
            <input id="date_of_birth" name="date_of_birth" type="date" />
          </div>
          <div className="form-field">
            <label htmlFor="photo">Photograph (optional)</label>
            <input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
          </div>
          <div className="form-field">
            <label htmlFor="house">House (optional)</label>
            <select id="house" name="house">
              <option value="">Not assigned</option>
              <option>Iqbal</option>
              <option>Jinnah</option>
              <option>Liaquat</option>
              <option>Fatima</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="class_id">Class</label>
            <select id="class_id" name="class_id" required>
              <option value="">Select a class&hellip;</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="academic_year_id">Academic year</label>
            <select id="academic_year_id" name="academic_year_id" defaultValue={defaultAcademicYearId}>
              <option value="">Select&hellip;</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.label}{y.is_current ? " (Current)" : ""}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="profile_id">Link to a student login (optional)</label>
            <select id="profile_id" name="profile_id">
              <option value="">No login yet / skip</option>
              {unlinkedStudentLogins.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="parent_profile_id">Link to a parent login (optional)</label>
            <select id="parent_profile_id" name="parent_profile_id">
              <option value="">No parent login yet / skip</option>
              {unlinkedParentLogins.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <CustomFieldInputs definitions={customFields} section="Student Information" />
          <button type="submit" className="btn btn-primary" disabled={submitting || classes.length === 0}>
            {submitting ? "Adding…" : "Add Student"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <p style={{ fontSize: "0.82rem", color: "var(--muted)", maxWidth: "480px" }}>
        Tip: create the student's (and parent's) login first from <Link href="/admin/create-user" style={{ color: "var(--accent-2)" }}>Create New Account</Link>, then come back here to link them.
      </p>
    </AdminLayout>
  );
}
