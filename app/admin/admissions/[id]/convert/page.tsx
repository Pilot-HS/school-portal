"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function ConvertApplicationPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [application, setApplication] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);

  const [studentName, setStudentName] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [classId, setClassId] = useState("");
  const [createParentLogin, setCreateParentLogin] = useState(true);
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [resultCredentials, setResultCredentials] = useState<{ email: string; password: string } | null>(null);

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

      const [{ data: app }, { data: classData }] = await Promise.all([
        supabase.from("admission_applications").select("*").eq("id", applicationId).single(),
        supabase.from("classes").select("*").order("grade"),
      ]);

      if (app) {
        setApplication(app);
        setStudentName(app.student_full_name);
        if (app.gr_number) setGrNumber(app.gr_number);
        if (app.student_email) setParentEmail(app.student_email);

        // Try to suggest a matching class by grade number
        const gradeNumber = (app.class_applying_for || "").replace(/\D/g, "");
        const matches = (classData || []).filter((c: any) => c.grade === gradeNumber);
        if (matches.length === 1) setClassId(matches[0].id);
      }
      setClasses(classData || []);
      setLoading(false);
    })();
  }, [router, applicationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/convert-application", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        application_id: applicationId,
        student_full_name: studentName,
        roll_no: rollNo,
        gr_number: grNumber,
        class_id: classId,
        create_parent_login: createParentLogin,
        parent_email: parentEmail,
        parent_password: parentPassword,
      }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Student record created and application marked Enrolled." });
      if (result.credentials) setResultCredentials(result.credentials);
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;
  if (!application) return <AdminLayout active="admissions" fullName={fullName}><p>Application not found.</p></AdminLayout>;

  if (application.converted_student_id) {
    return (
      <AdminLayout active="admissions" fullName={fullName}>
        <p>This application has already been converted to a student record.</p>
        <Link href="/admin/admissions" style={{ color: "var(--accent-2)" }}>&larr; Back to Admissions</Link>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <Link href={`/admin/admissions/${applicationId}`} style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Application</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Convert to Student</h1>

      {resultCredentials ? (
        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <h2>Success</h2>
          <p>Share these login details with the parent directly (in person or a trusted channel):</p>
          <table className="data-table">
            <tbody>
              <tr><th>Email</th><td>{resultCredentials.email}</td></tr>
              <tr><th>Password</th><td>{resultCredentials.password}</td></tr>
            </tbody>
          </table>
          {resultCredentials.email.endsWith("@gbhspilotdadu.local") && (
            <p className="form-note mt-32">
              This is an auto-generated login ID, not a real email address &mdash; the parent cannot use "Forgot Password" for it. If they lose this password, reset it manually from Supabase.
            </p>
          )}
          <Link href="/admin/admissions" className="btn btn-outline mt-32">Back to Admissions</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="portal-panel" style={{ maxWidth: "480px" }}>
            <h2>Student Record</h2>
            <div className="form-field">
              <label htmlFor="student_name">Student's full name</label>
              <input id="student_name" required value={studentName} onChange={(e) => setStudentName(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="roll_no">Roll number</label>
              <input id="roll_no" required value={rollNo} onChange={(e) => setRollNo(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="gr_number">GR Number</label>
              <input id="gr_number" value={grNumber} onChange={(e) => setGrNumber(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="class_id">Class (applied for {application.class_applying_for})</label>
              <select id="class_id" required value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class&hellip;</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="portal-panel" style={{ maxWidth: "480px" }}>
            <h2>Parent Login</h2>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400, marginBottom: "16px" }}>
              <input type="checkbox" checked={createParentLogin} onChange={(e) => setCreateParentLogin(e.target.checked)} style={{ width: "auto" }} />
              Create a parent login for {application.father_name || "this family"}
            </label>

            {createParentLogin && (
              <>
                <div className="form-field">
                  <label htmlFor="parent_email">Parent email (leave blank to auto-generate a login ID)</label>
                  <input id="parent_email" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
                </div>
                <div className="form-field">
                  <label htmlFor="parent_password">Temporary password (leave blank to auto-generate)</label>
                  <input id="parent_password" value={parentPassword} onChange={(e) => setParentPassword(e.target.value)} minLength={6} />
                </div>
                <p className="form-note" style={{ marginTop: "-8px" }}>
                  If no email is given, a login ID like parent-03001234567@gbhspilotdadu.local will be created instead &mdash; this works for logging in, but "Forgot Password" won't work for it since it's not a real inbox.
                </p>
              </>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Converting…" : "Create Student Record"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      )}
    </AdminLayout>
  );
}
