"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import CustomFieldInputs from "@/components/CustomFieldInputs";

export default function NewTeacherPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [createLogin, setCreateLogin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

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

      const { data: fields } = await supabase
        .from("custom_field_definitions")
        .select("*")
        .eq("form_type", "teacher")
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
    setCredentials(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("create_login", createLogin ? "yes" : "no");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-teacher", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Teacher record saved." });
      if (result.credentials) setCredentials(result.credentials);
      form.reset();
      setCreateLogin(false);
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <Link href="/admin/teachers" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Teachers</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "4px" }}>Add a Teacher</h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        <Link href="/admin/custom-fields" style={{ color: "var(--accent-2)" }}>Manage extra fields</Link> for this form.
      </p>

      <form onSubmit={handleSubmit}>
        {/* SECTION 1 — PERSONAL INFORMATION */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>1. Personal Information</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="full_name">Full name *</label>
              <input id="full_name" name="full_name" required />
            </div>
            <div className="form-field">
              <label htmlFor="father_husband_name">Father's / husband's name</label>
              <input id="father_husband_name" name="father_husband_name" />
            </div>
            <div className="form-field">
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender">
                <option value="">Select&hellip;</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="date_of_birth">Date of birth</label>
              <input id="date_of_birth" name="date_of_birth" type="date" />
            </div>
            <div className="form-field">
              <label htmlFor="cnic">CNIC number</label>
              <input id="cnic" name="cnic" placeholder="XXXXX-XXXXXXX-X" />
            </div>
            <div className="form-field">
              <label htmlFor="marital_status">Marital status</label>
              <select id="marital_status" name="marital_status">
                <option value="">Select&hellip;</option>
                <option>Single</option>
                <option>Married</option>
                <option>Widowed</option>
                <option>Divorced</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="religion">Religion</label>
              <input id="religion" name="religion" />
            </div>
            <div className="form-field">
              <label htmlFor="domicile">Domicile (district)</label>
              <input id="domicile" name="domicile" />
            </div>
            <div className="form-field">
              <label htmlFor="blood_group">Blood group</label>
              <select id="blood_group" name="blood_group">
                <option value="">Select&hellip;</option>
                <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option><option>Unknown</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="photo">Profile photo</label>
              <input id="photo" name="photo" type="file" accept="image/jpeg,image/png" />
            </div>
            <CustomFieldInputs definitions={customFields} section="Personal information" />
          </div>
        </div>

        {/* SECTION 2 — CONTACT INFORMATION */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>2. Contact Information</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="mobile_number">Mobile number</label>
              <input id="mobile_number" name="mobile_number" type="tel" />
            </div>
            <div className="form-field">
              <label htmlFor="emergency_contact">Emergency contact number</label>
              <input id="emergency_contact" name="emergency_contact" type="tel" />
            </div>
            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" />
            </div>
            <CustomFieldInputs definitions={customFields} section="Contact information" />
          </div>
          <div className="form-field">
            <label htmlFor="current_address">Current address</label>
            <input id="current_address" name="current_address" />
          </div>
          <div className="form-field">
            <label htmlFor="permanent_address">Permanent address</label>
            <input id="permanent_address" name="permanent_address" />
          </div>
        </div>

        {/* SECTION 3 — SERVICE / EMPLOYMENT DETAILS */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>3. Service / Employment Details</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="employee_number">Employee / personal number</label>
              <input id="employee_number" name="employee_number" />
            </div>
            <div className="form-field">
              <label htmlFor="designation">Designation</label>
              <input id="designation" name="designation" placeholder="e.g. PST, EST, SST, HST, Head Master" />
            </div>
            <div className="form-field">
              <label htmlFor="bps_grade">BPS grade</label>
              <select id="bps_grade" name="bps_grade">
                <option value="">Select&hellip;</option>
                {Array.from({ length: 14 }, (_, i) => i + 7).map((n) => <option key={n} value={`BPS-${n}`}>BPS-{n}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="employment_type">Employment type</label>
              <select id="employment_type" name="employment_type">
                <option value="">Select&hellip;</option>
                <option>Regular</option>
                <option>Contract</option>
                <option>Daily Wages</option>
                <option>Deputation</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="date_of_first_appointment">Date of first appointment</label>
              <input id="date_of_first_appointment" name="date_of_first_appointment" type="date" />
            </div>
            <div className="form-field">
              <label htmlFor="date_of_joining_school">Date of joining this school</label>
              <input id="date_of_joining_school" name="date_of_joining_school" type="date" />
            </div>
            <div className="form-field">
              <label htmlFor="previous_school">Previous school / posting</label>
              <input id="previous_school" name="previous_school" />
            </div>
            <div className="form-field">
              <label htmlFor="status">Status</label>
              <select id="status" name="status" defaultValue="Active">
                <option>Active</option>
                <option>On Leave</option>
                <option>Transferred</option>
                <option>Retired</option>
              </select>
            </div>
            <CustomFieldInputs definitions={customFields} section="Service / employment details" />
          </div>
        </div>

        {/* SECTION 4 — QUALIFICATIONS */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>4. Academic &amp; Professional Qualifications</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="academic_qualification">Highest academic qualification</label>
              <input id="academic_qualification" name="academic_qualification" placeholder="e.g. MA, MSc, BA" />
            </div>
            <div className="form-field">
              <label htmlFor="qualification_subject">Subject / field of study</label>
              <input id="qualification_subject" name="qualification_subject" />
            </div>
            <div className="form-field">
              <label htmlFor="professional_qualification">Professional qualification</label>
              <input id="professional_qualification" name="professional_qualification" placeholder="e.g. B.Ed, M.Ed, PTC, CT" />
            </div>
            <div className="form-field">
              <label htmlFor="university_board">University / board</label>
              <input id="university_board" name="university_board" />
            </div>
            <div className="form-field">
              <label htmlFor="passing_year">Passing year</label>
              <input id="passing_year" name="passing_year" placeholder="e.g. 2015" />
            </div>
            <CustomFieldInputs definitions={customFields} section="Academic and professional qualifications" />
          </div>
        </div>

        {/* SECTION 5 — DOCUMENTS */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>5. Documents</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="cnic_copy">CNIC copy</label>
              <input id="cnic_copy" name="cnic_copy" type="file" accept="image/jpeg,image/png" />
            </div>
            <div className="form-field">
              <label htmlFor="appointment_order">Appointment order</label>
              <input id="appointment_order" name="appointment_order" type="file" accept="image/jpeg,image/png" />
            </div>
            <div className="form-field">
              <label htmlFor="degree_certificate">Degree / certificate</label>
              <input id="degree_certificate" name="degree_certificate" type="file" accept="image/jpeg,image/png" />
            </div>
            <div className="form-field">
              <label htmlFor="joining_report">Joining report</label>
              <input id="joining_report" name="joining_report" type="file" accept="image/jpeg,image/png" />
            </div>
            <CustomFieldInputs definitions={customFields} section="Documents" />
          </div>
          <p className="form-note" style={{ marginBottom: 0 }}>All documents are optional and stored privately. Images must be JPEG or PNG, under 5MB each.</p>
        </div>

        {/* SECTION 6 — PORTAL ACCOUNT */}
        <div className="portal-panel" style={{ maxWidth: "480px" }}>
          <h2>6. Portal Account</h2>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400, marginBottom: "16px" }}>
            <input type="checkbox" checked={createLogin} onChange={(e) => setCreateLogin(e.target.checked)} style={{ width: "auto" }} />
            Create a portal login for this teacher
          </label>
          {createLogin && (
            <div className="form-field">
              <label htmlFor="login_password">Temporary password (leave blank to auto-generate)</label>
              <input id="login_password" name="login_password" minLength={6} />
              <p className="form-note" style={{ marginTop: "6px", marginBottom: 0 }}>
                Uses the email address entered above. If no email was given, a login ID will be auto-generated instead \u2014 "Forgot Password" won't work for that, so a real email is recommended.
              </p>
            </div>
          )}
          <CustomFieldInputs definitions={customFields} section="Portal account" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save Teacher"}
        </button>
        {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}

        {credentials && (
          <div className="portal-panel mt-32" style={{ maxWidth: "480px" }}>
            <h2>Login Created</h2>
            <table className="data-table">
              <tbody>
                <tr><th>Email</th><td>{credentials.email}</td></tr>
                <tr><th>Password</th><td>{credentials.password}</td></tr>
              </tbody>
            </table>
            <p className="form-note mt-32" style={{ marginBottom: 0 }}>Share these details with the teacher directly.</p>
          </div>
        )}
      </form>
    </AdminLayout>
  );
}
