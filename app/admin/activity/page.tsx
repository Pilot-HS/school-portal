"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const ACTIONS: Record<string, string> = {
  attendance: "Attendance",
  marks: "Marks",
  tests: "Tests",
  assignments: "Assignments",
  imports: "Imports",
  logins: "Logins",
  promotion: "Promotion",
  cover: "Cover",
};

async function api(path: string) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(path, { headers: { Authorization: `Bearer ${data.session?.access_token}` }, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

function Details({ d }: { d: any }) {
  if (!d) return null;
  const changed: any[] = Array.isArray(d.changed) ? d.changed : [];
  if (changed.length === 0) return null;
  return (
    <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "0.8rem", color: "var(--slate)" }}>
      {changed.map((c, i) => (
        <li key={i}>{c.student}: {String(c.from)} → <strong>{String(c.to)}</strong></li>
      ))}
    </ul>
  );
}

export default function ActivityPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (search.trim()) params.set("q", search.trim());
    const { ok, json } = await api(`/api/admin/activity?${params.toString()}`);
    if (!ok) {
      if (json.setup_needed) setSetupNeeded(true);
      else setError(json.error || "Could not load the activity log.");
    } else {
      setSetupNeeded(false);
      setEntries(json.entries || []);
    }
    setLoading(false);
  }, [action, search]);

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
      setReady(true);
    })();
  }, [router]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [ready, load, search]);

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <AdminLayout active="activity" fullName={fullName}>
      <h1 className="t-page-title">Activity Log</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: -6 }}>
        A record of who marked attendance, entered or changed marks, created tests, posted assignments, and ran imports, logins and promotions.
      </p>

      {setupNeeded ? (
        <div className="portal-panel">
          <h2>One-time setup needed</h2>
          <p style={{ marginTop: 0 }}>Run <strong>setup-database.sql</strong> once in Supabase (SQL Editor &rarr; New query &rarr; paste &rarr; Run), then reload this page.</p>
        </div>
      ) : (
        <>
          <div className="portal-panel">
            <div className="t-form-grid">
              <div className="form-field">
                <label htmlFor="a_action">Type</label>
                <select id="a_action" value={action} onChange={(e) => setAction(e.target.value)}>
                  <option value="">Everything</option>
                  {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="a_search">Search</label>
                <input id="a_search" placeholder="Words in the description" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>

          {error && <div className="t-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}

          <div className="portal-panel">
            {loading ? (
              <div className="skeleton" style={{ height: 160 }} />
            ) : entries.length === 0 ? (
              <div className="t-empty">Nothing recorded yet. New activity will appear here.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead>
                  <tbody>
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{new Date(e.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                        <td>{e.who}{e.role ? <div className="t-test-meta">{e.role}</div> : null}</td>
                        <td>
                          <span className="pill pill-gray" style={{ marginRight: 6 }}>{ACTIONS[e.action] || e.action}</span>
                          {e.summary}
                          <Details d={e.details} />
                        </td>
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
