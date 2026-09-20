"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import CustomFieldInputs from "@/components/CustomFieldInputs";

const DOC_FIELDS = [
  { key: "cnic_copy_path", formField: "cnic_copy", label: "CNIC Copy" },
  { key: "appointment_order_path", formField: "appointment_order", label: "Appointment Order" },
  { key: "degree_certificate_path", formField: "degree_certificate", label: "Degree / Certificate" },
  { key: "joining_report_path", formField: "joining_report", label: "Joining Report" },
];

export default function EditTeacherPage() {
  const router = useRouter();
  const params = useParams();
  const teacherId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [teacher, setTeacher] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
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

      const token = session.access_token;

      const [{ data: teacherRow }, { data: fields }] = await Promise.all([
        supabase.from("teachers").select("*").eq("id", teacherId).single(),
        supabase.from("custom_field_definitions").select("*").eq("form_type", "teacher").eq("is_active", true).order("display_order"),
      ]);

      if (teacherRow) {
        setTeacher(teacherRow);
        setCustomFields(fields || []);

        const urls: Record<string, string> = {};
        if (teacherRow.photo_path) {
          const res = await fetch("/api/admin/get-signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: teacherRow.photo_path }),
          });
          const result = await res.json();
          if (res.ok) setPhotoUrl(result.url);
        }

        for (const f of DOC_FIELDS) {
          if (teacherRow[f.key]) {
            const res = await fetch("/api/admin/get-signed-url", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ path: teacherRow[f.key] }),
            });
            const result = await res.json();
            if (res.ok) urls[f.formField] = result.url;
          }
        }
        setDocUrls(urls);

        // Load custom field values for this teacher
        if ((fields || []).length > 0) {
          const { data: values } = await supabase
            .from("custom_field_values")
            .select("*")
            .eq("record_id", teacherId)
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
      setLoading(false);
    })();
  }, [router, teacherId]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.set("teacher_id", teacherId);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/update-teacher", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
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
  if (!teacher) return <AdminLayout active="teachers" fullName={fullName}><p>Teacher not found.</p></AdminLayout>;

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <Link href="/admin/teachers" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Teachers</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Edit Teacher</h1>

      <form onSubmit={handleSubmit}>
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>1. Personal Information</h2>
          {photoUrl && (
            <div className="form-field">
              <img src={photoUrl} alt={teacher.full_name} style={{ width: "100px", height: "100px", objectFit: "cover", border: "1px solid var(--border)" }} />
            </div>
          )}
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="full_name">Full name *</label>
              <input id="full_name" name="full_name" required defaultValue={teacher.full_name} />
            </div>
            <div className="form-field">
              <label htmlFor="father_husband_name">Father's / husband's name</label>
              <input id="father_husband_name" name="father_husband_name" defaultValue={teacher.father_husband_name || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender" defaultValue={teacher.gender || ""}>
                <option value="">Select&hellip;</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="date_of_birth">Date of birth</label>
              <input id="date_of_birth" name="date_of_birth" type="date" defaultValue={teacher.date_of_birth || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="cnic">CNIC number</label>
              <input id="cnic" name="cnic" defaultValue={teacher.cnic || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="marital_status">Marital status</label>
              <select id="marital_status" name="marital_status" defaultValue={teacher.marital_status || ""}>
                <option value="">Select&hellip;</option>
                <option>Single</option><option>Married</option><option>Widowed</option><option>Divorced</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="religion">Religion</label>
              <input id="religion" name="religion" defaultValue={teacher.religion || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="domicile">Domicile (district)</label>
              <input id="domicile" name="domicile" defaultValue={teacher.domicile || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="blood_group">Blood group</label>
              <select id="blood_group" name="blood_group" defaultValue={teacher.blood_group || ""}>
                <option value="">Select&hellip;</option>
                <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option><option>Unknown</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="photo">Replace photo</label>
              <input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
            </div>
            <CustomFieldInputs definitions={customFields} section="Personal information" values={customValues} fileUrls={customFileUrls} />
          </div>
        </div>

        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>2. Contact Information</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="mobile_number">Mobile number</label>
              <input id="mobile_number" name="mobile_number" type="tel" defaultValue={teacher.mobile_number || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="emergency_contact">Emergency contact number</label>
              <input id="emergency_contact" name="emergency_contact" type="tel" defaultValue={teacher.emergency_contact || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" defaultValue={teacher.email || ""} />
            </div>
            <CustomFieldInputs definitions={customFields} section="Contact information" values={customValues} fileUrls={customFileUrls} />
          </div>
          <div className="form-field">
            <label htmlFor="current_address">Current address</label>
            <input id="current_address" name="current_address" defaultValue={teacher.current_address || ""} />
          </div>
          <div className="form-field">
            <label htmlFor="permanent_address">Permanent address</label>
            <input id="permanent_address" name="permanent_address" defaultValue={teacher.permanent_address || ""} />
          </div>
        </div>

        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>3. Service / Employment Details</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="employee_number">Employee / personal number</label>
              <input id="employee_number" name="employee_number" defaultValue={teacher.employee_number || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="designation">Designation</label>
              <input id="designation" name="designation" defaultValue={teacher.designation || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="bps_grade">BPS grade</label>
              <select id="bps_grade" name="bps_grade" defaultValue={teacher.bps_grade || ""}>
                <option value="">Select&hellip;</option>
                {Array.from({ length: 14 }, (_, i) => i + 7).map((n) => <option key={n} value={`BPS-${n}`}>BPS-{n}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="employment_type">Employment type</label>
              <select id="employment_type" name="employment_type" defaultValue={teacher.employment_type || ""}>
                <option value="">Select&hellip;</option>
                <option>Regular</option><option>Contract</option><option>Daily Wages</option><option>Deputation</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="date_of_first_appointment">Date of first appointment</label>
              <input id="date_of_first_appointment" name="date_of_first_appointment" type="date" defaultValue={teacher.date_of_first_appointment || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="date_of_joining_school">Date of joining this school</label>
              <input id="date_of_joining_school" name="date_of_joining_school" type="date" defaultValue={teacher.date_of_joining_school || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="previous_school">Previous school / posting</label>
              <input id="previous_school" name="previous_school" defaultValue={teacher.previous_school || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue={teacher.status || "Active"}>
                <option>Active</option><option>On Leave</option><option>Transferred</option><option>Retired</option>
              </select>
            </div>
            <CustomFieldInputs definitions={customFields} section="Service / employment details" values={customValues} fileUrls={customFileUrls} />
          </div>
        </div>

        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>4. Academic &amp; Professional Qualifications</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="academic_qualification">Highest academic qualification</label>
              <input id="academic_qualification" name="academic_qualification" defaultValue={teacher.academic_qualification || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="qualification_subject">Subject / field of study</label>
              <input id="qualification_subject" name="qualification_subject" defaultValue={teacher.qualification_subject || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="professional_qualification">Professional qualification</label>
              <input id="professional_qualification" name="professional_qualification" defaultValue={teacher.professional_qualification || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="university_board">University / board</label>
              <input id="university_board" name="university_board" defaultValue={teacher.university_board || ""} />
            </div>
            <div className="form-field">
              <label htmlFor="passing_year">Passing year</label>
              <input id="passing_year" name="passing_year" defaultValue={teacher.passing_year || ""} />
            </div>
            <CustomFieldInputs definitions={customFields} section="Academic and professional qualifications" values={customValues} fileUrls={customFileUrls} />
          </div>
        </div>

        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>5. Documents</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "16px", marginBottom: "20px" }}>
            {DOC_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: "0.76rem", color: "var(--muted)", marginBottom: "6px" }}>{f.label}</div>
                {docUrls[f.formField] ? (
                  <a href={docUrls[f.formField]} target="_blank" rel="noopener noreferrer">
                    <img src={docUrls[f.formField]} alt={f.label} style={{ width: "100%", border: "1px solid var(--border)", objectFit: "cover", height: "100px" }} />
                  </a>
                ) : (
                  <div style={{ width: "100%", height: "100px", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", color: "var(--muted)", textAlign: "center" }}>
                    Not on file
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="form-grid">
            <div className="form-field"><label htmlFor="cnic_copy">Replace CNIC copy</label><input id="cnic_copy" name="cnic_copy" type="file" accept="image/jpeg,image/png" /></div>
            <div className="form-field"><label htmlFor="appointment_order">Replace appointment order</label><input id="appointment_order" name="appointment_order" type="file" accept="image/jpeg,image/png" /></div>
            <div className="form-field"><label htmlFor="degree_certificate">Replace degree / certificate</label><input id="degree_certificate" name="degree_certificate" type="file" accept="image/jpeg,image/png" /></div>
            <div className="form-field"><label htmlFor="joining_report">Replace joining report</label><input id="joining_report" name="joining_report" type="file" accept="image/jpeg,image/png" /></div>
            <CustomFieldInputs definitions={customFields} section="Documents" values={customValues} fileUrls={customFileUrls} />
          </div>
        </div>

        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <h2>6. Portal Account</h2>
          <p style={{ fontSize: "0.85rem" }}>
            {teacher.profile_id ? "This teacher has a linked portal login." : "This teacher does not have a portal login yet. Use \"Create New Account\" from the Admin dashboard, then link it here by re-saving with the login's email matching above."}
          </p>
          <CustomFieldInputs definitions={customFields} section="Portal account" values={customValues} fileUrls={customFileUrls} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save Changes"}
        </button>
        {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
      </form>
    </AdminLayout>
  );
}
