"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";
import StudentView from "@/components/StudentView";
import ChangePasswordPanel from "@/components/ChangePasswordPanel";

export default function StudentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [student, setStudent] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const [{ data: profile }, { data: studentRow }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("students").select("*, classes(name)").eq("profile_id", session.user.id).maybeSingle(),
      ]);

      if (!profile || profile.role !== "student") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setStudent(studentRow);
    } catch {
      setError("We couldn't load your portal. Please check your internet and try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="skeleton-wrap" aria-busy="true">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 80 }} />
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  }

  return (
    <div>
      <PortalNav role="student" fullName={fullName} />
      <div className="portal-main">
        {error ? (
          <div className="t-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-outline" onClick={load}>Try again</button>
          </div>
        ) : !student ? (
          <div className="portal-panel">
            <h2>No student record linked yet</h2>
            <p>Your login works, but the school admin hasn&apos;t linked your account to a student record yet. Ask the office to complete this step.</p>
          </div>
        ) : (
          <>
            <div className="t-hero no-print">
              <div className="t-hero-date">Student Portal</div>
              <h1>Welcome, {student.full_name}</h1>
              <div style={{ position: "relative", zIndex: 1 }}>
                <span className="t-chip"><GraduationCap size={14} /> {student.classes?.name ? `Class ${student.classes.name}` : "No class assigned"}</span>
                <span className="t-chip">Roll No. {student.roll_no}</span>
              </div>
            </div>
            <StudentView student={student} audience="students" />
            <ChangePasswordPanel />
          </>
        )}
      </div>
    </div>
  );
}
