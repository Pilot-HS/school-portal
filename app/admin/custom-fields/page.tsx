"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const TEACHER_SECTIONS = [
  "Personal information",
  "Contact information",
  "Service / employment details",
  "Academic and professional qualifications",
  "Documents",
  "Portal account",
];
const STUDENT_SECTIONS = ["Student Information"];

const FIELD_TYPES = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "yes_no", label: "Yes / No" },
  { value: "file", label: "File upload" },
];

export default function CustomFieldsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [formType, setFormType] = useState<"teacher" | "student">("teacher");
  const [fields, setFields] = useState<any[]>([]);

  const [label, setLabel] = useState("");
  const [section, setSection] = useState(TEACHER_SECTIONS[0]);
  const [fieldType, setFieldType] = useState("short_text");
  const [optionsText, setOptionsText] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadFields() {
    const { data } = await supabase
      .from("custom_field_definitions")
      .select("*")
      .eq("form_type", formType)
      .order("section")
      .order("display_order");
    setFields(data || []);
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
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!loading) loadFields();
    setSection(formType === "teacher" ? TEACHER_SECTIONS[0] : STUDENT_SECTIONS[0]);
  }, [formType, loading]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const options = fieldType === "dropdown" ? optionsText.split(",").map((o) => o.trim()).filter(Boolean) : null;

    const res = await fetch("/api/admin/create-custom-field", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ form_type: formType, section, label, field_type: fieldType, options, is_required: isRequired }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `"${label}" added.` });
      setLabel("");
      setOptionsText("");
      setIsRequired(false);
      await loadFields();
    }
    setSubmitting(false);
  }

  async function toggleActive(fieldId: string, currentActive: boolean) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    await fetch("/api/admin/update-custom-field", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field_id: fieldId, is_active: !currentActive }),
    });
    await loadFields();
  }

  async function deleteField(fieldId: string, fieldLabel: string) {
    if (!window.confirm(`Delete "${fieldLabel}"? This only works if no data has been saved for it yet.`)) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/delete-custom-field", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ field_id: fieldId }),
    });
    const result = await res.json();
    if (!res.ok) {
      alert(result.error);
    } else {
      await loadFields();
    }
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const sections = formType === "teacher" ? TEACHER_SECTIONS : STUDENT_SECTIONS;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Manage Extra Fields</h1>
      <p style={{ color: "var(--muted)", marginBottom: "20px" }}>
        Add custom fields to the Student or Teacher forms without any code changes. Hiding a field keeps its saved data; deleting only works if no data has been entered yet.
      </p>

      <div className="sub-tabs">
        <button className={formType === "teacher" ? "active" : ""} onClick={() => setFormType("teacher")}>Teacher Form</button>
        <button className={formType === "student" ? "active" : ""} onClick={() => setFormType("student")}>Student Form</button>
      </div>

      <div className="portal-panel" style={{ maxWidth: "480px" }}>
        <h2>Add a Field</h2>
        <form onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="label">Field label</label>
            <input id="label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Bank account title" />
          </div>
          <div className="form-field">
            <label htmlFor="section">Section</label>
            <select id="section" value={section} onChange={(e) => setSection(e.target.value)}>
              {sections.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="field_type">Field type</label>
            <select id="field_type" value={fieldType} onChange={(e) => setFieldType(e.target.value)}>
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {fieldType === "dropdown" && (
            <div className="form-field">
              <label htmlFor="options">Dropdown options (comma-separated)</label>
              <input id="options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="e.g. Option A, Option B, Option C" />
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 400, marginBottom: "16px" }}>
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} style={{ width: "auto" }} />
            Required field
          </label>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add Field"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </form>
      </div>

      <div className="portal-panel">
        <h2>{formType === "teacher" ? "Teacher" : "Student"} Form Fields</h2>
        {fields.length === 0 ? <p>No extra fields added yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Label</th><th>Section</th><th>Type</th><th>Required</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.id}>
                  <td>{f.label}</td>
                  <td>{f.section}</td>
                  <td>{FIELD_TYPES.find((t) => t.value === f.field_type)?.label || f.field_type}</td>
                  <td>{f.is_required ? "Yes" : "No"}</td>
                  <td><span className={`pill ${f.is_active ? "pill-green" : "pill-red"}`}>{f.is_active ? "Visible" : "Hidden"}</span></td>
                  <td style={{ display: "flex", gap: "6px" }}>
                    <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => toggleActive(f.id, f.is_active)}>
                      {f.is_active ? "Hide" : "Unhide"}
                    </button>
                    <button className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem", color: "#a13636" }} onClick={() => deleteField(f.id, f.label)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
