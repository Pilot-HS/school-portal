"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { formatDate, localISODate } from "@/lib/teacherUi";

async function api(path: string, method = "GET", body?: any) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function WebsiteEditorsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [editors, setEditors] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [pick, setPick] = useState<any>(null);
  const [canPublish, setCanPublish] = useState(false);
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async (q = "") => {
    const { ok, json } = await api(`/api/admin/site-editors?q=${encodeURIComponent(q)}`);
    if (!ok) {
      if (json.setup_needed) setSetupNeeded(true);
      else setMessage({ type: "error", text: json.error || "Could not load." });
      return;
    }
    setEditors(json.editors || []);
    setPeople(json.people || []);
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

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => load(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query, ready, load]);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) return;
    setBusy(true);
    setMessage(null);
    const { ok, json } = await api("/api/admin/site-editors", "POST", { user_id: pick.id, can_publish: canPublish, expires_on: until || null, note });
    if (!ok) setMessage({ type: "error", text: json.error || "Could not save." });
    else {
      setMessage({ type: "success", text: `${pick.full_name} can now edit the website.` });
      setPick(null);
      setQuery("");
      setUntil("");
      setNote("");
      setCanPublish(false);
      await load();
    }
    setBusy(false);
  }

  async function revoke(e: any) {
    if (!window.confirm(`Stop ${e.name} from editing the website?`)) return;
    const { ok, json } = await api("/api/admin/site-editors", "DELETE", { user_id: e.user_id });
    if (!ok) setMessage({ type: "error", text: json.error || "Could not remove." });
    else await load(query.trim());
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <AdminLayout active="website-editors" fullName={fullName}>
      <h1 className="t-page-title">Who can edit the website</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: -6 }}>
        Admins can always edit. You can also let a teacher, student or parent edit for a while, for example to update the gallery after an event.
        When they log in to their own portal and visit the website, they see the editing tools. You choose whether they can publish, and when their permission ends.
      </p>

      {setupNeeded ? (
        <div className="portal-panel">
          <h2>One-time setup needed</h2>
          <p style={{ marginTop: 0 }}>Run <strong>setup-database.sql</strong> once in Supabase (SQL Editor → New query → paste → Run), then reload this page.</p>
        </div>
      ) : (
        <>
          <div className="portal-panel" style={{ maxWidth: 640 }}>
            <h2>Give someone permission</h2>
            {!pick ? (
              <>
                <div className="form-field">
                  <label htmlFor="we_search">Find a person by name</label>
                  <div className="auth-input-wrap">
                    <input id="we_search" placeholder="Type at least 2 letters" value={query} onChange={(e) => setQuery(e.target.value)} />
                    <span className="auth-toggle" style={{ pointerEvents: "none" }}><Search size={16} /></span>
                  </div>
                </div>
                {people.map((p) => (
                  <button key={p.id} type="button" className="admin-attention" style={{ width: "100%", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }} onClick={() => setPick(p)}>
                    <span className="sv-child-avatar">{String(p.full_name).charAt(0).toUpperCase()}</span>
                    <span>{p.full_name}<span className="t-test-meta" style={{ display: "block", fontWeight: 400 }}>{p.role}</span></span>
                  </button>
                ))}
                {query.trim().length >= 2 && people.length === 0 && <p className="t-hint">No teacher, student or parent found with that name.</p>}
              </>
            ) : (
              <form onSubmit={grant}>
                <p style={{ marginTop: 0 }}><strong>{pick.full_name}</strong> <span className="pill pill-gray">{pick.role}</span> <button type="button" className="auth-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setPick(null)}>Change</button></p>
                <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.9rem", cursor: "pointer", marginBottom: 14 }}>
                  <input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
                  <span><strong>Can publish</strong> their own changes. If this is off, their changes wait for an admin to publish them.</span>
                </label>
                <div className="form-field">
                  <label htmlFor="we_until">Permission ends on (optional)</label>
                  <input id="we_until" type="date" min={localISODate()} value={until} onChange={(e) => setUntil(e.target.value)} />
                  <p className="t-hint" style={{ margin: "4px 0 0" }}>Leave empty to keep the permission until you remove it.</p>
                </div>
                <div className="form-field">
                  <label htmlFor="we_note">Note (optional)</label>
                  <input id="we_note" maxLength={150} placeholder="e.g. Updating the gallery after Sports Day" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Allow editing"}</button>
              </form>
            )}
            {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
          </div>

          <div className="portal-panel">
            <h2>People who can edit</h2>
            {editors.length === 0 ? (
              <div className="t-empty">Nobody besides the admins yet.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Name</th><th>Can publish</th><th>Until</th><th>Note</th><th></th></tr></thead>
                  <tbody>
                    {editors.map((e) => (
                      <tr key={e.user_id}>
                        <td><strong>{e.name}</strong><div className="t-test-meta">{e.role}</div></td>
                        <td>{e.can_publish ? <span className="pill pill-green">Yes</span> : <span className="pill pill-gray">No</span>}</td>
                        <td>{e.expires_at ? <>{formatDate(e.expires_at)} {e.expired && <span className="pill pill-red">Ended</span>}</> : "No end date"}</td>
                        <td>{e.note || "—"}</td>
                        <td><button className="t-icon-btn danger" onClick={() => revoke(e)} aria-label={`Remove ${e.name}`}><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
