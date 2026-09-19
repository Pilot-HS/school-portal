"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

function daysUntilNextBirthday(dob: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(dob);
  let next = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
  }
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function BirthdaysPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [students, setStudents] = useState<any[]>([]);

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

      const { data } = await supabase
        .from("students")
        .select("*, classes(name)")
        .not("date_of_birth", "is", null);

      const withDays = (data || []).map((s) => ({ ...s, daysUntil: daysUntilNextBirthday(s.date_of_birth) }));
      withDays.sort((a, b) => a.daysUntil - b.daysUntil);
      setStudents(withDays);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const thisWeek = students.filter((s) => s.daysUntil <= 7);
  const thisMonth = students.filter((s) => s.daysUntil > 7 && s.daysUntil <= 31);

  function renderRow(s: any) {
    const label = s.daysUntil === 0 ? "Today!" : s.daysUntil === 1 ? "Tomorrow" : `In ${s.daysUntil} days`;
    return (
      <tr key={s.id}>
        <td>{s.full_name}</td>
        <td>{s.classes?.name || "\u2014"}</td>
        <td>{new Date(s.date_of_birth).toLocaleDateString(undefined, { month: "long", day: "numeric" })}</td>
        <td><span className={`pill ${s.daysUntil <= 7 ? "pill-amber" : "pill-green"}`}>{label}</span></td>
      </tr>
    );
  }

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Student Birthdays</h1>

      <div className="portal-panel">
        <h2>This Week</h2>
        {thisWeek.length === 0 ? <p>No birthdays in the next 7 days.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Class</th><th>Birthday</th><th></th></tr></thead>
            <tbody>{thisWeek.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      <div className="portal-panel">
        <h2>This Month</h2>
        {thisMonth.length === 0 ? <p>No more birthdays in the next 31 days.</p> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Class</th><th>Birthday</th><th></th></tr></thead>
            <tbody>{thisMonth.map(renderRow)}</tbody>
          </table>
        )}
      </div>

      {students.length === 0 && (
        <p style={{ color: "var(--muted)" }}>No students have a date of birth on file yet &mdash; add one when editing a student record.</p>
      )}
    </AdminLayout>
  );
}
