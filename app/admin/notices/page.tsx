"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Copy } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const SCHOOL = "Government Boys High School, P.H. Pilot, Dadu";

function shareText(n: any) {
  return `📢 *${SCHOOL}*\n\n*${n.title}*${n.body ? `\n\n${n.body}` : ""}\n\n${new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`;
}

export default function NoticesListPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [notices, setNotices] = useState<any[]>([]);
  const [copied, setCopied] = useState("");

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

  async function copy(n: any) {
    try {
      await navigator.clipboard.writeText(shareText(n));
      setCopied(n.id);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this text:", shareText(n));
    }
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="notices" fullName={fullName}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Notices</h1>
        <Link href="/admin/notices/new" className="btn btn-primary">Post a Notice</Link>
      </div>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: -8 }}>
        Tap <strong>WhatsApp</strong> on a notice to send it to a class or parents&apos; group from your own WhatsApp. The portal doesn&apos;t send messages by itself.
      </p>

      {notices.length === 0 ? (
        <div className="portal-panel"><p>No notices posted yet.</p></div>
      ) : (
        <div className="t-list">
          {notices.map((n) => (
            <div className="portal-panel" key={n.id} style={{ marginBottom: 0 }}>
              <div className="t-row-between" style={{ alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700 }}>{n.title}</div>
                  <div className="t-test-meta">
                    {new Date(n.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · for {n.audience}
                  </div>
                  {n.body && <p style={{ margin: "8px 0 0", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{n.body}</p>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a className="btn btn-primary" style={{ background: "#25a244", borderColor: "#25a244" }} href={`https://wa.me/?text=${encodeURIComponent(shareText(n))}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={15} /> WhatsApp
                  </a>
                  <button className="btn btn-outline" onClick={() => copy(n)}><Copy size={15} /> {copied === n.id ? "Copied" : "Copy"}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
