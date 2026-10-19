"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";
import StudentView from "@/components/StudentView";

export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");

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

      const [{ data: profile }, { data: kids }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("students").select("*, classes(name)").eq("parent_profile_id", session.user.id),
      ]);

      if (!profile || profile.role !== "parent") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setChildren(kids || []);
      if (kids && kids.length > 0) setSelectedId((prev) => prev || kids[0].id);
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

  const child = children.find((c) => c.id === selectedId) || children[0];

  return (
    <div>
      <PortalNav role="parent" fullName={fullName} />
      <div className="portal-main">
        {error ? (
          <div className="t-error" role="alert">
            <span>{error}</span>
            <button className="btn btn-outline" onClick={load}>Try again</button>
          </div>
        ) : children.length === 0 ? (
          <div className="portal-panel">
            <h2>No children linked yet</h2>
            <p>Your login works, but the school admin hasn&apos;t linked a student to your account yet. Ask the office to complete this step.</p>
          </div>
        ) : (
          <>
            <div className="t-hero">
              <div className="t-hero-date">Parent Portal</div>
              <h1>Welcome, {fullName}</h1>
              <div style={{ position: "relative", zIndex: 1 }}>
                <span className="t-chip"><GraduationCap size={14} /> {child.full_name}</span>
                <span className="t-chip">{child.classes?.name ? `Class ${child.classes.name}` : "No class assigned"}</span>
                <span className="t-chip">Roll No. {child.roll_no}</span>
              </div>
            </div>

            {children.length > 1 && (
              <div className="sv-children" role="tablist" aria-label="Choose a child">
                {children.map((c) => (
                  <button key={c.id} role="tab" aria-selected={c.id === child.id} className={c.id === child.id ? "active" : ""} onClick={() => setSelectedId(c.id)}>
                    <span className="sv-child-avatar">{String(c.full_name).charAt(0).toUpperCase()}</span>
                    {c.full_name}
                  </button>
                ))}
              </div>
            )}

            <StudentView key={child.id} student={child} audience="parents" />
          </>
        )}
      </div>
    </div>
  );
}
