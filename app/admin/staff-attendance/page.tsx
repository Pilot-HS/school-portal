"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const today = () => new Date().toISOString().slice(0, 10);

export default function StaffAttendancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [teachers, setTeachers] = useState<any[]>([]);
  const [date, setDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function loadForDate(selectedDate: string) {
    const { data: teacherData } = await supabase.from("teachers").select("*").eq("is_active", true).order("full_name");
    setTeachers(teacherData || []);

    const { data: existing } = await supabase.from("staff_attendance").select("*").eq("date", selectedDate);
    const defaults: Record<string, string> = {};
    (teacherData || []).forEach((t) => {
      const found = (existing || []).find((e) => e.teacher_id === t.id);
      defaults[t.id] = found ? found.status : "present";
    });
    setStatuses(defaults);
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
      await loadForDate(date);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!loading) loadForDate(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function setStatus(teacherId: string, status: string) {
    setStatuses((prev) => ({ ...prev, [teacherId]: status }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const records = teachers.map((t) => ({ teacher_id: t.id, status: statuses[t.id] || "present" }));

    const res = await fetch("/api/admin/mark-staff-attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ date, records }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: `Attendance saved for ${result.count} staff members on ${date}.` });
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="teachers" fullName={fullName}>
      <Link href="/admin/teachers" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Teachers</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Staff Attendance</h1>

      <div className="portal-panel" style={{ maxWidth: "300px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="portal-panel">
          <h2>Staff</h2>
          {teachers.length === 0 ? (
            <p>No active teachers on file yet.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Designation</th><th>Status</th></tr></thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td>{t.full_name}</td>
                    <td>{t.designation || t.subject || "\u2014"}</td>
                    <td>
                      <select value={statuses[t.id] || "present"} onChange={(e) => setStatus(t.id, e.target.value)} style={{ width: "auto", padding: "6px 10px" }}>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Leave</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {teachers.length > 0 && (
            <button type="submit" className="btn btn-primary" style={{ marginTop: "16px" }} disabled={submitting}>
              {submitting ? "Saving…" : "Save Attendance"}
            </button>
          )}
          {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
        </div>
      </form>
    </AdminLayout>
  );
}
