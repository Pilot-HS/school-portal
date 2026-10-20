"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { classLabel } from "@/lib/teacherUi";

type PlanRow = { id: string; name: string; from_roll: string; to_roll: string; status: "same" | "renumbered" | "skipped"; reason?: string };

async function call(body: any) {
  const { data } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/promote-students", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function PromoteStudentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [fromClassId, setFromClassId] = useState("");
  const [toClassId, setToClassId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [renumber, setRenumber] = useState(true);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ promoted: string[]; skipped: { name: string; reason: string }[] } | null>(null);

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
      const { data: classData } = await supabase.from("classes").select("*").order("grade");
      setClasses(classData || []);
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    setPlan(null);
    setResult(null);
    if (!fromClassId) {
      setStudents([]);
      setSelected(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase.from("students").select("*").eq("class_id", fromClassId).order("roll_no");
      const active = (data || []).filter((s: any) => s.is_active !== false);
      setStudents(active);
      setSelected(new Set(active.map((s: any) => s.id)));
    })();
  }, [fromClassId]);

  // Any change to the choices clears the preview, so it can never be out of date
  useEffect(() => {
    setPlan(null);
  }, [toClassId, renumber, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function preview() {
    setBusy(true);
    setError("");
    setResult(null);
    const { ok, json } = await call({ student_ids: Array.from(selected), new_class_id: toClassId, renumber, dry_run: true });
    if (!ok) setError(json.error || "Could not check the promotion.");
    else setPlan(json.plan);
    setBusy(false);
  }

  async function confirm() {
    if (!plan) return;
    const moving = plan.filter((p) => p.status !== "skipped").length;
    if (!window.confirm(`Move ${moving} students to the new class? This changes their class right away.`)) return;
    setBusy(true);
    setError("");
    const { ok, json } = await call({ student_ids: Array.from(selected), new_class_id: toClassId, renumber });
    if (!ok) setError(json.error || "Promotion failed.");
    else {
      setResult({ promoted: json.promoted, skipped: json.skipped });
      setPlan(null);
      const { data } = await supabase.from("students").select("*").eq("class_id", fromClassId).order("roll_no");
      const active = (data || []).filter((s: any) => s.is_active !== false);
      setStudents(active);
      setSelected(new Set());
    }
    setBusy(false);
  }

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  const toLabel = classLabel(classes.find((c) => c.id === toClassId));
  const counts = plan ? { same: plan.filter((p) => p.status === "same").length, renum: plan.filter((p) => p.status === "renumbered").length, skip: plan.filter((p) => p.status === "skipped").length } : null;

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" className="t-back">&larr; Back to Students</Link>
      <h1 className="t-page-title" style={{ marginTop: 8 }}>Promote Students</h1>

      <div className="portal-panel" style={{ maxWidth: 620 }}>
        <div className="t-form-grid">
          <div className="form-field">
            <label htmlFor="from_class">From class</label>
            <select id="from_class" value={fromClassId} onChange={(e) => setFromClassId(e.target.value)}>
              <option value="">Select&hellip;</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="to_class">To class</label>
            <select id="to_class" value={toClassId} onChange={(e) => setToClassId(e.target.value)}>
              <option value="">Select&hellip;</option>
              {classes.filter((c) => c.id !== fromClassId).map((c) => <option key={c.id} value={c.id}>{classLabel(c)}</option>)}
            </select>
          </div>
        </div>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: "0.88rem", cursor: "pointer" }}>
          <input type="checkbox" checked={renumber} onChange={(e) => setRenumber(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
          <span>If a roll number is already taken in the new class, give that student the next free number (otherwise they are skipped).</span>
        </label>
      </div>

      {fromClassId && (
        <div className="portal-panel">
          <h2>Select students to promote</h2>
          {students.length === 0 ? (
            <p>No students in this class.</p>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button className="btn btn-outline" onClick={() => setSelected(new Set(students.map((s) => s.id)))}>All</button>
                <button className="btn btn-outline" onClick={() => setSelected(new Set())}>None</button>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
                <table className="data-table">
                  <thead><tr><th></th><th>Roll No.</th><th>Name</th></tr></thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id}>
                        <td><input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} style={{ width: 18, height: 18 }} /></td>
                        <td>{s.roll_no}</td>
                        <td>{s.full_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={busy || selected.size === 0 || !toClassId} onClick={preview}>
            {busy && !plan ? "Checking…" : `Check ${selected.size} student${selected.size === 1 ? "" : "s"} first`}
          </button>
          {error && <p className="error-text" role="alert">{error}</p>}
        </div>
      )}

      {plan && counts && (
        <div className="portal-panel">
          <h2>Preview &mdash; moving to {toLabel}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <span className="pill pill-green">{counts.same} keep their roll number</span>
            {counts.renum > 0 && <span className="pill pill-amber">{counts.renum} get a new roll number</span>}
            {counts.skip > 0 && <span className="pill pill-red">{counts.skip} will be skipped</span>}
          </div>
          <div style={{ overflowX: "auto", maxHeight: 360, overflowY: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Roll now</th><th>Roll in {toLabel}</th><th></th></tr></thead>
              <tbody>
                {plan.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.from_roll}</td>
                    <td>{p.status === "skipped" ? "—" : p.to_roll}</td>
                    <td>
                      {p.status === "same" && <span className="pill pill-green">OK</span>}
                      {p.status === "renumbered" && <span className="pill pill-amber">New number</span>}
                      {p.status === "skipped" && <span style={{ color: "#a13636", fontSize: "0.8rem" }}>{p.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={confirm} disabled={busy || counts.same + counts.renum === 0}>
              {busy ? "Promoting…" : `Confirm — move ${counts.same + counts.renum} students`}
            </button>
            <button className="btn btn-outline" onClick={() => setPlan(null)} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}

      {result && (
        <div className="portal-panel">
          {result.promoted.length > 0 && <p className="success-text" style={{ marginTop: 0 }}>Promoted {result.promoted.length}: {result.promoted.join(", ")}</p>}
          {result.skipped.length > 0 && (
            <div>
              <p className="error-text" style={{ marginBottom: 6 }}>Skipped:</p>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {result.skipped.map((s, i) => <li key={i} style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{s.name} &mdash; {s.reason}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
