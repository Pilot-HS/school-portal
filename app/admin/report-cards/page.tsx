"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import ReportCardsTool from "@/components/ReportCardsTool";

export default function AdminReportCardsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const [{ data: profile }, { data: cls }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("classes").select("*").order("grade"),
      ]);
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setClasses(cls || []);
      setReady(true);
    })();
  }, [router]);

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <AdminLayout active="reports" fullName={fullName}>
      <h1 className="t-page-title no-print">Report Cards</h1>
      <ReportCardsTool classes={classes} myClassIds={[]} />
    </AdminLayout>
  );
}
