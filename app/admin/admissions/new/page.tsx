"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const CLASSES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`);
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"];
const RELATIONSHIPS = ["Father", "Mother", "Grandfather", "Uncle", "Guardian", "Other"];

export default function NewAdmissionApplicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmation, setConfirmation] = useState<{ referenceId: string; studentName: string; classApplying: string; academicYear: string; date: string } | null>(null);

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

      const { data: years } = await supabase.from("academic_years").select("*").order("label", { ascending: false });
      setAcademicYears(years || []);

      setLoading(false);
    })();
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("sibling_enrolled", (form.elements.namedItem("sibling_enrolled") as HTMLInputElement)?.checked ? "yes" : "no");
    formData.set("declaration_accepted", (form.elements.namedItem("declaration_accepted") as HTMLInputElement)?.checked ? "yes" : "no");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-admission-application", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setConfirmation({
        referenceId: result.reference_id,
        studentName: formData.get("student_full_name") as string,
        classApplying: formData.get("class_applying_for") as string,
        academicYear: academicYears.find((y) => y.id === formData.get("academic_year_id"))?.label || "",
        date: new Date().toLocaleDateString(),
      });
      form.reset();
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  if (confirmation) {
    return (
      <AdminLayout active="admissions" fullName={fullName}>
        <div className="portal-panel" style={{ maxWidth: "520px" }}>
          <button className="btn btn-primary no-print" style={{ marginBottom: "16px" }} onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <div style={{ borderBottom: "2px solid var(--ink)", paddingBottom: "12px", marginBottom: "16px" }}>
            <h2 style={{ margin: 0 }}>Government Boys High School, P.H. Pilot, Dadu</h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>Application Confirmation</p>
          </div>
          <table className="data-table">
            <tbody>
              <tr><th>Reference ID</th><td style={{ fontWeight: 700 }}>{confirmation.referenceId}</td></tr>
              <tr><th>Student Name</th><td>{confirmation.studentName}</td></tr>
              <tr><th>Class Applying For</th><td>{confirmation.classApplying}</td></tr>
              <tr><th>Academic Year</th><td>{confirmation.academicYear}</td></tr>
              <tr><th>Date Submitted</th><td>{confirmation.date}</td></tr>
            </tbody>
          </table>
          <p className="form-note mt-32">Keep this reference ID for any future inquiries about this application.</p>
          <button className="btn btn-outline no-print mt-32" onClick={() => setConfirmation(null)}>Add Another Application</button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <Link href="/admin/admissions" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Admissions</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>New Admission Application</h1>

      {academicYears.length === 0 && (
        <div className="portal-panel" style={{ borderColor: "#c9992e", maxWidth: "760px" }}>
          <p style={{ margin: 0 }}>
            No academic years exist yet. <Link href="/admin/academic-years" style={{ color: "var(--accent-2)", fontWeight: 600 }}>Add one first</Link>, then come back here.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* SECTION 1 — STUDENT DETAILS */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>1. Student Details</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="student_full_name">Full name *</label>
              <input id="student_full_name" name="student_full_name" required />
            </div>
            <div className="form-field">
              <label htmlFor="gender">Gender</label>
              <select id="gender" name="gender">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="date_of_birth">Date of birth</label>
              <input id="date_of_birth" name="date_of_birth" type="date" />
            </div>
            <div className="form-field">
              <label htmlFor="place_of_birth">Place of birth</label>
              <input id="place_of_birth" name="place_of_birth" />
            </div>
            <div className="form-field">
              <label htmlFor="nationality">Nationality</label>
              <input id="nationality" name="nationality" defaultValue="Pakistani" />
            </div>
            <div className="form-field">
              <label htmlFor="religion">Religion</label>
              <input id="religion" name="religion" />
            </div>
            <div className="form-field">
              <label htmlFor="blood_group">Blood group</label>
              <select id="blood_group" name="blood_group">
                <option value="">Select&hellip;</option>
                {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="bform_number">B-Form number</label>
              <input id="bform_number" name="bform_number" />
            </div>
            <div className="form-field">
              <label htmlFor="student_contact">Student contact (optional)</label>
              <input id="student_contact" name="student_contact" type="tel" />
            </div>
            <div className="form-field">
              <label htmlFor="student_email">Email (optional)</label>
              <input id="student_email" name="student_email" type="email" />
            </div>
            <div className="form-field">
              <label htmlFor="city">City</label>
              <input id="city" name="city" />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="student_photo">Student photograph</label>
              <input id="student_photo" name="student_photo" type="file" accept="image/jpeg,image/png" />
            </div>
            <div className="form-field">
              <label htmlFor="bform_image">B-Form image</label>
              <input id="bform_image" name="bform_image" type="file" accept="image/jpeg,image/png" />
            </div>
          </div>
        </div>

        {/* SECTION 2 — FATHER / GUARDIAN DETAILS */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>2. Father / Guardian Details</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="father_name">Father's name</label>
              <input id="father_name" name="father_name" />
            </div>
            <div className="form-field">
              <label htmlFor="guardian_relationship">Relationship to student</label>
              <select id="guardian_relationship" name="guardian_relationship" defaultValue="Father">
                {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="father_occupation">Occupation</label>
              <input id="father_occupation" name="father_occupation" />
            </div>
            <div className="form-field">
              <label htmlFor="caste">Caste</label>
              <input id="caste" name="caste" />
            </div>
            <div className="form-field">
              <label htmlFor="father_cnic">CNIC number</label>
              <input id="father_cnic" name="father_cnic" placeholder="XXXXX-XXXXXXX-X" />
            </div>
            <div className="form-field">
              <label htmlFor="parent_contact">Parent/guardian contact number *</label>
              <input id="parent_contact" name="parent_contact" type="tel" required />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="father_cnic_front">CNIC front image</label>
              <input id="father_cnic_front" name="father_cnic_front" type="file" accept="image/jpeg,image/png" />
            </div>
            <div className="form-field">
              <label htmlFor="father_cnic_back">CNIC back image</label>
              <input id="father_cnic_back" name="father_cnic_back" type="file" accept="image/jpeg,image/png" />
            </div>
          </div>
        </div>

        {/* SECTION 3 — ACADEMIC HISTORY */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>3. Academic History</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="last_school_name">Last attended school name</label>
              <input id="last_school_name" name="last_school_name" />
            </div>
            <div className="form-field">
              <label htmlFor="last_school_class">Last attended class</label>
              <input id="last_school_class" name="last_school_class" />
            </div>
            <div className="form-field">
              <label htmlFor="class_applying_for">Class applying for *</label>
              <select id="class_applying_for" name="class_applying_for" required>
                <option value="">Select&hellip;</option>
                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="academic_year_id">Academic year *</label>
              <select id="academic_year_id" name="academic_year_id" required defaultValue={academicYears.find((y) => y.is_current)?.id || ""}>
                <option value="">Select&hellip;</option>
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>{y.label}{y.is_current ? " (Current)" : ""}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="last_school_certificate">Last school's certificate / progress report (image)</label>
            <input id="last_school_certificate" name="last_school_certificate" type="file" accept="image/jpeg,image/png" />
          </div>
        </div>

        {/* SECTION 4 — EXTRA */}
        <div className="portal-panel" style={{ maxWidth: "760px" }}>
          <h2>4. Additional Information</h2>
          <div className="form-field">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400 }}>
              <input type="checkbox" id="sibling_enrolled" name="sibling_enrolled" style={{ width: "auto" }} />
              This student has a sibling already enrolled at the school
            </label>
          </div>
          <div className="form-field">
            <label htmlFor="sibling_name">Sibling's name (if applicable)</label>
            <input id="sibling_name" name="sibling_name" />
          </div>
          <div className="form-field">
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400 }}>
              <input type="checkbox" id="declaration_accepted" name="declaration_accepted" style={{ width: "auto" }} required />
              I certify that the information provided above is accurate to the best of my knowledge.
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Save Application"}
        </button>
        {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "10px" }}>
          Images must be JPEG or PNG, under 5MB each.
        </p>
      </form>
    </AdminLayout>
  );
}
