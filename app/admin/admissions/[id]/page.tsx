"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const STATUS_OPTIONS = ["new", "under_review", "approved", "rejected", "enrolled"];
const STATUS_LABELS: Record<string, string> = {
  new: "New", under_review: "Under Review", approved: "Approved", rejected: "Rejected", enrolled: "Enrolled",
};

const DOC_FIELDS: { key: string; label: string }[] = [
  { key: "student_photo_path", label: "Student Photograph" },
  { key: "bform_image_path", label: "B-Form Image" },
  { key: "father_cnic_front_path", label: "Father's CNIC (Front)" },
  { key: "father_cnic_back_path", label: "Father's CNIC (Back)" },
  { key: "last_school_certificate_path", label: "Last School Certificate" },
];

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
      <div style={{ fontSize: "0.95rem" }}>{value || "\u2014"}</div>
    </div>
  );
}

export default function AdmissionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const applicationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [application, setApplication] = useState<any>(null);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  const [status, setStatus] = useState("new");
  const [section, setSection] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [saving, setSaving] = useState(false);
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

      const { data: app } = await supabase.from("admission_applications").select("*").eq("id", applicationId).single();
      if (app) {
        setApplication(app);
        setStatus(app.status);
        setSection(app.section || "");
        setGrNumber(app.gr_number || "");

        const token = session.access_token;
        const urls: Record<string, string> = {};
        await Promise.all(
          DOC_FIELDS.map(async (f) => {
            const path = app[f.key];
            if (!path) return;
            const res = await fetch("/api/admin/get-signed-url", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ path }),
            });
            const result = await res.json();
            if (res.ok) urls[f.key] = result.url;
          })
        );
        setDocUrls(urls);
      }
      setLoading(false);
    })();
  }, [router, applicationId]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/update-admission-application", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ application_id: applicationId, status, section, gr_number: grNumber }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Saved." });
    }
    setSaving(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;
  if (!application) return <AdminLayout active="admissions" fullName={fullName}><p>Application not found.</p></AdminLayout>;

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <Link href="/admin/admissions" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Admissions</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>{application.student_full_name}</h1>

      <div className="portal-panel" style={{ maxWidth: "500px" }}>
        <h2>School Use Only</h2>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="status">Status</label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="section">Section</label>
            <input id="section" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. A" />
          </div>
          <div className="form-field">
            <label htmlFor="gr_number">GR Number</label>
            <input id="gr_number" value={grNumber} onChange={(e) => setGrNumber(e.target.value)} placeholder="e.g. 1245" />
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Student Details</h2>
        <div className="form-grid">
          <Field label="Full Name" value={application.student_full_name} />
          <Field label="Gender" value={application.gender} />
          <Field label="Date of Birth" value={application.date_of_birth} />
          <Field label="Place of Birth" value={application.place_of_birth} />
          <Field label="Nationality" value={application.nationality} />
          <Field label="Religion" value={application.religion} />
          <Field label="Blood Group" value={application.blood_group} />
          <Field label="B-Form Number" value={application.bform_number} />
          <Field label="Student Contact" value={application.student_contact} />
          <Field label="Email" value={application.student_email} />
          <Field label="City" value={application.city} />
        </div>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Father / Guardian Details</h2>
        <div className="form-grid">
          <Field label="Father's Name" value={application.father_name} />
          <Field label="Relationship" value={application.guardian_relationship} />
          <Field label="Occupation" value={application.father_occupation} />
          <Field label="Caste" value={application.caste} />
          <Field label="CNIC Number" value={application.father_cnic} />
          <Field label="Parent Contact" value={application.parent_contact} />
        </div>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Academic History</h2>
        <div className="form-grid">
          <Field label="Last School" value={application.last_school_name} />
          <Field label="Last Class" value={application.last_school_class} />
          <Field label="Class Applying For" value={application.class_applying_for} />
        </div>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Additional Information</h2>
        <div className="form-grid">
          <Field label="Sibling Already Enrolled" value={application.sibling_enrolled ? `Yes (${application.sibling_name || "name not given"})` : "No"} />
          <Field label="Declaration Accepted" value={application.declaration_accepted ? "Yes" : "No"} />
        </div>
      </div>

      <div className="portal-panel" style={{ maxWidth: "760px" }}>
        <h2>Uploaded Documents</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "16px" }}>
          {DOC_FIELDS.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginBottom: "6px" }}>{f.label}</div>
              {docUrls[f.key] ? (
                <a href={docUrls[f.key]} target="_blank" rel="noopener noreferrer">
                  <img src={docUrls[f.key]} alt={f.label} style={{ width: "100%", border: "1px solid var(--border)", objectFit: "cover", height: "120px" }} />
                </a>
              ) : (
                <div style={{ width: "100%", height: "120px", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", color: "var(--muted)" }}>
                  Not uploaded
                </div>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "14px" }}>
          Document links expire after 1 hour for security &mdash; refresh this page if they stop working.
        </p>
      </div>
    </AdminLayout>
  );
}
