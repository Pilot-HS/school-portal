"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import CustomFieldInputs from "@/components/CustomFieldInputs";

const DOC_FIELDS: { key: string; label: string }[] = [
  { key: "bform_image_path", label: "B-Form Image" },
  { key: "father_cnic_front_path", label: "Father's CNIC (Front)" },
  { key: "father_cnic_back_path", label: "Father's CNIC (Back)" },
  { key: "last_school_certificate_path", label: "Last School Certificate" },
];

const EVENT_LABELS: Record<string, string> = {
  enrolled: "Enrolled",
  created: "Record Created",
  class_change: "Class Changed",
  activated: "Activated",
  deactivated: "Deactivated / Transferred Out",
};

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
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [customFileUrls, setCustomFileUrls] = useState<Record<string, string>>({});

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

      const [{ data: studentRow }, { data: classData }, { data: studentProfiles }, { data: parentProfiles }, { data: years }, { data: historyRows }, { data: fields }] = await Promise.all([
        supabase.from("students").select("*").eq("id", studentId).single(),
        supabase.from("classes").select("*").order("grade"),
        supabase.from("profiles").select("id, full_name").eq("role", "student"),
        supabase.from("profiles").select("id, full_name").eq("role", "parent"),
        supabase.from("academic_years").select("*").order("label", { ascending: false }),
        supabase.from("student_history").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
        supabase.from("custom_field_definitions").select("*").eq("form_type", "student").eq("is_active", true).order("display_order"),
      ]);
      setCustomFields(fields || []);

      if (studentRow) {
        setStudent(studentRow);
        const token = session.access_token;

        const pathsToFetch: { key: string; path: string }[] = [];
        if (studentRow.photo_path) pathsToFetch.push({ key: "__photo__", path: studentRow.photo_path });
        DOC_FIELDS.forEach((f) => {
          if (studentRow[f.key]) pathsToFetch.push({ key: f.key, path: studentRow[f.key] });
        });

        const urls: Record<string, string> = {};
        await Promise.all(
          pathsToFetch.map(async ({ key, path }) => {
            const res = await fetch("/api/admin/get-signed-url", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ path }),
            });
            const result = await res.json();
            if (res.ok) urls[key] = result.url;
          })
        );
        if (urls["__photo__"]) setPhotoUrl(urls["__photo__"]);
        setDocUrls(urls);

        if ((fields || []).length > 0) {
          const { data: values } = await supabase
            .from("custom_field_values")
            .select("*")
            .eq("record_id", studentId)
            .in("field_definition_id", (fields || []).map((f: any) => f.id));

          const valMap: Record<string, string> = {};
          const fileMap: Record<string, string> = {};
          for (const v of values || []) {
            if (v.value) valMap[v.field_definition_id] = v.value;
            if (v.file_path) {
              const res = await fetch("/api/admin/get-signed-url", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ path: v.file_path }),
              });
              const result = await res.json();
              if (res.ok) fileMap[v.field_definition_id] = result.url;
            }
          }
          setCustomValues(valMap);
          setCustomFileUrls(fileMap);
        }
      }
      setClasses(classData || []);
      setAcademicYears(years || []);
      setStudentLogins(studentProfiles || []);
      setParentLogins(parentProfiles || []);
      setHistory(historyRows || []);
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
            <label htmlFor="house">House</label>
            <select id="house" name="house" defaultValue={student.house || ""}>
              <option value="">Not assigned</option>
              <option>Iqbal</option>
              <option>Jinnah</option>
              <option>Liaquat</option>
              <option>Fatima</option>
            </select>
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
          <CustomFieldInputs definitions={customFields} section="Student Information" values={customValues} fileUrls={customFileUrls} />
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Changes"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Documents</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "16px" }}>
          {DOC_FIELDS.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: "6px" }}>{f.label}</div>
              {docUrls[f.key] ? (
                <a href={docUrls[f.key]} target="_blank" rel="noopener noreferrer">
                  <img src={docUrls[f.key]} alt={f.label} style={{ width: "100%", border: "1px solid var(--border)", objectFit: "cover", height: "110px" }} />
                </a>
              ) : (
                <div style={{ width: "100%", height: "110px", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.74rem", color: "var(--muted)", textAlign: "center" }}>
                  Not on file
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="form-note mt-32" style={{ marginBottom: 0 }}>
          Documents only appear here if this student was converted from an admission application. Links expire after 1 hour &mdash; refresh the page if needed.
        </p>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>History</h2>
        {history.length === 0 ? <p>No history recorded yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Event</th><th>Details</th></tr></thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{new Date(h.created_at).toLocaleDateString()}</td>
                  <td>{EVENT_LABELS[h.event_type] || h.event_type}</td>
                  <td>{h.details || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
