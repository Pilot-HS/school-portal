"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

export default function NoticesListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [notices, setNotices] = useState<any[]>([]);

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

      const { data } = await supabase.from("notices").select("*").order("created_at", { ascending: false });
      setNotices(data || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="notices" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Notices</h1>
        <Link href="/admin/notices/new" className="btn btn-primary">Post a Notice</Link>
      </div>

      <div className="portal-panel">
        {notices.length === 0 ? <p>No notices posted yet.</p> : (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Title</th><th>Audience</th></tr></thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id}><td>{new Date(n.created_at).toLocaleDateString()}</td><td>{n.title}</td><td>{n.audience}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}
