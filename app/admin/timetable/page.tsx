"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import ComingSoon from "@/components/ComingSoon";

export default function TimetablePage() {
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
    <AdminLayout active="timetable" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }}>Timetable</h1>
      <ComingSoon
        title="Timetable management is coming soon"
        description="This will let you build each class's weekly period-by-period schedule, visible to students, parents, and teachers. Not built yet — let me know when you'd like to prioritize it."
      />
    </AdminLayout>
  );
}
