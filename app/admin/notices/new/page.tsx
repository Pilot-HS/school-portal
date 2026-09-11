"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function NewNoticePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");

  const [title, setTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/admin/create-notice", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, notice_body: noticeBody, audience }),
    });
    const result = await res.json();

    if (!res.ok) {
      setMessage({ type: "error", text: result.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Notice posted." });
      setTitle("");
      setNoticeBody("");
      setAudience("all");
    }
    setSubmitting(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="portal-main">
        <Link href="/admin" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to Dashboard</Link>
        <h1 style={{ fontSize: "1.4rem", marginTop: "10px" }}>Post a Notice</h1>

        <div className="portal-panel" style={{ maxWidth: "520px" }}>
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="title">Title</label>
              <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="body">Details (optional)</label>
              <textarea
                id="body"
                rows={4}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)" }}
                value={noticeBody}
                onChange={(e) => setNoticeBody(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="audience">Audience</label>
              <select id="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
                <option value="all">Everyone</option>
                <option value="students">Students only</option>
                <option value="parents">Parents only</option>
                <option value="teachers">Teachers only</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Posting…" : "Post Notice"}
            </button>
            {message && <p className={message.type === "success" ? "success-text" : "error-text"}>{message.text}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
