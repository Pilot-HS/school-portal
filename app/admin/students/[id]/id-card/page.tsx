"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function StudentIdCardPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [photoUrl, setPhotoUrl] = useState("");

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

      const { data: studentRow } = await supabase.from("students").select("*, classes(name)").eq("id", studentId).single();
      if (studentRow) {
        setStudent(studentRow);
        if (studentRow.photo_path) {
          const token = session.access_token;
          const res = await fetch("/api/admin/get-signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: studentRow.photo_path }),
          });
          const result = await res.json();
          if (res.ok) setPhotoUrl(result.url);
        }
      }
      setLoading(false);
    })();
  }, [router, studentId]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;
  if (!student) return <AdminLayout active="students" fullName={fullName}><p>Student not found.</p></AdminLayout>;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" className="no-print" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Students</Link>
      <h1 className="no-print" style={{ fontSize: "1.4rem", marginTop: "10px", marginBottom: "20px" }}>Student ID Card</h1>

      <button className="btn btn-primary no-print" style={{ marginBottom: "20px" }} onClick={() => window.print()}>
        Print / Save as PDF
      </button>

      <div style={{
        width: "340px",
        border: "2px solid #163a2b",
        borderRadius: "8px",
        overflow: "hidden",
        fontFamily: "Georgia, serif",
      }}>
        <div style={{ background: "#163a2b", color: "#fff", padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>Government Boys High School</div>
          <div style={{ fontSize: "0.72rem" }}>P.H. Pilot, Dadu</div>
        </div>
        <div style={{ padding: "16px", display: "flex", gap: "14px", background: "#fff" }}>
          <div style={{ width: "80px", height: "96px", border: "1px solid #dbe1da", flexShrink: 0, overflow: "hidden" }}>
            {photoUrl ? (
              <img src={photoUrl} alt={student.full_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "#6b7a71", textAlign: "center" }}>
                No Photo
              </div>
            )}
          </div>
          <div style={{ fontFamily: "-apple-system, sans-serif", fontSize: "0.82rem", lineHeight: 1.6 }}>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: "2px" }}>{student.full_name}</div>
            <div><strong>Class:</strong> {student.classes?.name || "\u2014"}</div>
            <div><strong>Roll No:</strong> {student.roll_no}</div>
            <div><strong>GR No:</strong> {student.gr_number || "\u2014"}</div>
            <div><strong>DOB:</strong> {student.date_of_birth || "\u2014"}</div>
          </div>
        </div>
        <div style={{ background: "#f6edd9", padding: "8px 16px", fontSize: "0.7rem", textAlign: "center", color: "#a97c22", fontFamily: "-apple-system, sans-serif" }}>
          This card is the property of GBHS Pilot Dadu
        </div>
      </div>
    </AdminLayout>
  );
}
