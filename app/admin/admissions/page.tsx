"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import ComingSoon from "@/components/ComingSoon";

export default function AdmissionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");

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

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="admissions" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }}>Admissions</h1>
      <ComingSoon
        title="Admissions tracking is coming soon"
        description="This will let you log inquiries from prospective families and track them through to enrollment, before they become a full student record. For now, continue adding enrolled students directly via the Students tab."
      />
    </AdminLayout>
  );
}
