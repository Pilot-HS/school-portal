"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Printer, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { classLabel } from "@/lib/teacherUi";

type Created = { name: string; student: string; label: string; roll: string; role: string; email: string; password: string };

const KIND_LABEL: Record<string, string> = { student: "Student", parent: "Parent", teacher: "Teacher" };

async function api(body: any) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/bulk-logins", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function BulkLoginsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [kind, setKind] = useState("student");
  const [classId, setClassId] = useState("");
  const [pending, setPending] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState<Created[]>([]);
  const [failed, setFailed] = useState<{ name: string; label: string; error: string }[]>([]);
  const [error, setError] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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

  useEffect(() => {
    if (!ready) return;
    (async () => {
      setChecking(true);
      setError("");
      setPending(null);
      const { ok, json } = await api({ kind, class_id: kind === "teacher" ? null : classId || null, dry_run: true });
      if (!ok) setError(json.error || "Could not check.");
      else setPending(json.pending);
      setChecking(false);
    })();
  }, [ready, kind, classId]);

  async function start() {
    if (!pending) return;
    if (!window.confirm(`Create ${pending} ${KIND_LABEL[kind].toLowerCase()} logins now?`)) return;
    setRunning(true);
    setError("");
    setCreated([]);
    setFailed([]);
    const total = pending;
    let done = 0;
    let guard = 0;
    while (guard++ < 60) {
      const { ok, json } = await api({ kind, class_id: kind === "teacher" ? null : classId || null });
      if (!ok) {
        setError(json.error || "Something went wrong. The logins created so far are listed below.");
        break;
      }
      setCreated((prev) => [...prev, ...json.created]);
      setFailed((prev) => [...prev, ...json.failed]);
      done += json.created.length + json.failed.length;
      setProgress(Math.min(total, done));
      // Stop when nothing is left, or nothing in this round could be created (avoid looping on failures)
      if (json.remaining === 0 || json.created.length === 0) break;
    }
    setRunning(false);
    const check = await api({ kind, class_id: kind === "teacher" ? null : classId || null, dry_run: true });
    if (check.ok) setPending(check.json.pending);
  }

  function downloadCsv() {
    const rows = [["Role", "Name", "Class", "Roll", "Login email", "Password"]];
    created.forEach((c) => rows.push([KIND_LABEL[c.role], c.name, c.label, c.roll, c.email, c.password]));
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `new-logins-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <AdminLayout active="accounts" fullName={fullName}>
      <div className="no-print">
        <h1 className="t-page-title">Bulk Logins</h1>
        <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: -6 }}>
          Create logins for many people at once. Each login is created and linked to the right student or teacher automatically.
          Only people who don&apos;t have a login yet are included.
        </p>

        <div className="portal-panel" style={{ maxWidth: 620 }}>
          <h2>Who needs logins?</h2>
          <div className="t-form-grid">
            <div className="form-field">
              <label htmlFor="bl_kind">Login type</label>
              <select id="bl_kind" value={kind} onChange={(e) => setKind(e.target.value)} disabled={running}>
                <option value="student">Student logins</option>
                <option value="parent">Parent logins (one per student)</option>
                <option value="teacher">Teacher logins</option>
              </select>
            </div>
            {kind !== "teacher" && (
              <div className="form-field">
                <label htmlFor="bl_class">Class</label>
                <select id="bl_class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={running}>
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
                </select>
              </div>
            )}
          </div>
          <p style={{ margin: "4px 0 14px" }}>
            {checking ? "Checking…" : pending === null ? "" : pending === 0 ? "Everyone here already has a login." : <><strong>{pending}</strong> {pending === 1 ? "person needs" : "people need"} a login.</>}
          </p>
          <button className="btn btn-primary" onClick={start} disabled={running || checking || !pending}>
            <KeyRound size={15} /> {running ? `Creating… ${progress}/${pending}` : pending ? `Create ${pending} logins` : "Create logins"}
          </button>
          {error && <p className="error-text" role="alert">{error}</p>}
          {kind === "parent" && <p className="t-hint">Brothers and sisters get separate parent logins. Merge them later by linking one parent login to several students if you wish.</p>}
        </div>

        {created.length > 0 && (
          <div className="portal-panel">
            <div className="t-error" style={{ background: "#fff7e0", color: "#7a5a00", borderColor: "#ecd48b" }}>
              <span><strong>Save these now.</strong> Passwords can&apos;t be shown again after you leave this page. Download the list or print the slips and hand them out.</span>
            </div>
            <h2>{created.length} {created.length === 1 ? "login" : "logins"} created</h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} /> Print slips</button>
              <button className="btn btn-outline" onClick={downloadCsv}><Download size={15} /> Download list (CSV)</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Class / ref.</th><th>Login email</th><th>Password</th></tr></thead>
                <tbody>
                  {created.map((c) => (
                    <tr key={c.email}>
                      <td>{c.name}</td>
                      <td>{c.label}{c.roll ? ` · Roll ${c.roll}` : ""}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{c.email}</td>
                      <td style={{ fontFamily: "monospace", fontWeight: 700 }}>{c.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {failed.length > 0 && (
          <div className="portal-panel">
            <h2>{failed.length} could not be created</h2>
            {failed.map((f, i) => <p key={i} className="error-text" style={{ margin: "6px 0" }}><strong>{f.name}</strong> ({f.label}): {f.error}</p>)}
          </div>
        )}
      </div>

      {/* Printable slips */}
      <div className="print-only">
        <div className="slip-grid">
          {created.map((c) => (
            <div className="slip" key={c.email}>
              <div className="slip-school">Government Boys High School, P.H. Pilot, Dadu</div>
              <div className="slip-role">{KIND_LABEL[c.role]} Portal Login</div>
              <div className="slip-name">{c.name}</div>
              <div className="slip-line">{c.label}{c.roll ? ` · Roll ${c.roll}` : ""}</div>
              <div className="slip-line">Website: <strong>{origin}/login</strong></div>
              <div className="slip-line">Email: <strong>{c.email}</strong></div>
              <div className="slip-line">Password: <strong className="slip-pw">{c.password}</strong></div>
              <div className="slip-note">Please change your password after your first login.</div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
