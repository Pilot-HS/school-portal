"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink, Globe, UserCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

async function api(method = "GET") {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/site-seed", { method, headers: { Authorization: `Bearer ${data.session?.access_token}` }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function AdminWebsitePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [status, setStatus] = useState<{ tables_ready: boolean; pages: any[]; error?: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const { ok, json } = await api();
    if (ok) setStatus(json);
    else setMessage({ type: "error", text: json.error || "Could not check the website." });
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      await load();
      setReady(true);
    })();
  }, [router, load]);

  async function seed() {
    setBusy(true);
    setMessage(null);
    const { ok, json } = await api("POST");
    if (!ok) setMessage({ type: "error", text: json.error || "Could not load the content." });
    else {
      setMessage({ type: "success", text: `Done. ${json.pages} pages were loaded.` });
      await load();
    }
    setBusy(false);
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  const pages = status?.pages || [];
  const href = (p: any) => (p.is_home ? "/" : `/${p.slug}`);

  return (
    <AdminLayout active="website" fullName={fullName}>
      <h1 className="t-page-title">Website</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: -6 }}>
        The school website now lives inside the portal. The public site is at the main address, and the portal stays at <strong>/login</strong>.
      </p>

      {status && !status.tables_ready && (
        <div className="portal-panel">
          <h2>One-time setup needed</h2>
          <ol style={{ paddingLeft: 20, lineHeight: 1.7, fontSize: "0.9rem" }}>
            <li>Open your project in <strong>Supabase</strong> → <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
            <li>Paste everything from the file <strong>setup-database.sql</strong> and press <strong>Run</strong>.</li>
            <li>Come back here and reload this page.</li>
          </ol>
        </div>
      )}

      {status && status.tables_ready && pages.length === 0 && (
        <div className="portal-panel" style={{ maxWidth: 620 }}>
          <h2>Fill the new website</h2>
          <p style={{ marginTop: 0 }}>The website is empty. This copies the current pages of the school website (Home, About, Academics and the rest) into the new system. It only works while the website is empty, so it can&apos;t overwrite anything.</p>
          <button className="btn btn-primary" onClick={seed} disabled={busy}>{busy ? "Loading…" : "Load the current website content"}</button>
        </div>
      )}
      {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}

      {pages.length > 0 && (
        <>
          <div className="t-actions" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            <a href="/" target="_blank" rel="noopener noreferrer" className="t-action">
              <div className="icon-badge icon-badge-green"><Globe size={22} /></div>
              <div><div className="t-action-title">View the website</div><div className="t-action-desc">Opens in a new tab</div></div>
              <ExternalLink size={18} className="t-action-arrow" />
            </a>
            <Link href="/admin/website-editors" className="t-action">
              <div className="icon-badge icon-badge-amber"><UserCheck size={22} /></div>
              <div><div className="t-action-title">Who can edit</div><div className="t-action-desc">Allow a teacher or student for a while</div></div>
            </Link>
          </div>

          <div className="portal-panel">
            <h2>Pages ({pages.length})</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Page</th><th>Address</th><th>In menu</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {pages.map((p) => (
                    <tr key={p.id}>
                      <td><strong>{p.title}</strong></td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{href(p)}</td>
                      <td>{p.show_in_menu ? "Yes" : "Hidden"}</td>
                      <td><span className={`pill ${p.has_unpublished ? "pill-amber" : "pill-green"}`}>{p.has_unpublished ? "Unpublished changes" : "Published"}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}><a className="auth-link" href={`${href(p)}?edit=1`}>Edit</a> &nbsp; <a className="auth-link" href={href(p)} target="_blank" rel="noopener noreferrer">View</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="t-hint">Press <strong>Edit</strong> to change a page directly on the website. You can also open any page while logged in and press <strong>Edit this page</strong> in the dark bar at the bottom.</p>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
