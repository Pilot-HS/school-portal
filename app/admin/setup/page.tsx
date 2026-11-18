"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

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

type Row = { id: string; demo?: boolean; [k: string]: any };

function Group({ title, rows, picked, setPicked, render, note }: { title: string; rows: Row[]; picked: Set<string>; setPicked: (s: Set<string>) => void; render: (r: Row) => React.ReactNode; note?: string }) {
  if (rows.length === 0) return null;
  const toggle = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setPicked(n);
  };
  const selectable = rows.filter((r) => !r.protected);
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="t-row-between" style={{ flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{title} <span className="pill pill-gray">{picked.size} of {rows.length} selected</span></h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => setPicked(new Set(rows.filter((r) => r.demo && !r.protected).map((r) => r.id)))}>Sample data only</button>
          <button type="button" className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => setPicked(new Set(selectable.map((r) => r.id)))}>All</button>
          <button type="button" className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "0.78rem" }} onClick={() => setPicked(new Set())}>None</button>
        </div>
      </div>
      {note && <p className="t-hint" style={{ margin: "4px 0 6px" }}>{note}</p>}
      <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, marginTop: 8 }}>
        {rows.map((r) => (
          <label key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: "0.88rem", cursor: r.protected ? "not-allowed" : "pointer", opacity: r.protected ? 0.55 : 1 }}>
            <input type="checkbox" disabled={!!r.protected} checked={picked.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 18, height: 18 }} />
            <span style={{ flex: 1 }}>{render(r)}</span>
            {r.demo ? <span className="pill pill-amber">Sample</span> : <span className="pill pill-gray">Other</span>}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");

  const [grid, setGrid] = useState<any[]>([]);
  const [otherClasses, setOtherClasses] = useState<string[]>([]);
  const [cMsg, setCMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cBusy, setCBusy] = useState(false);

  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState("");
  const [students, setStudents] = useState<Set<string>>(new Set());
  const [teachers, setTeachers] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Set<string>>(new Set());
  const [assignments, setAssignments] = useState<Set<string>>(new Set());
  const [exams, setExams] = useState<Set<string>>(new Set());
  const [deleteLogins, setDeleteLogins] = useState(true);
  const [clearMcq, setClearMcq] = useState(false);
  const [clearHolidays, setClearHolidays] = useState(false);
  const [clearCover, setClearCover] = useState(false);
  const [clearAudit, setClearAudit] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ done: Record<string, number>; problems: string[] } | null>(null);
  const [error, setError] = useState("");

  const loadClasses = useCallback(async () => {
    const { ok, json } = await api("/api/admin/setup-classes");
    if (ok) {
      setGrid(json.grid || []);
      setOtherClasses(json.other_classes || []);
    }
  }, []);

  const loadCleanup = useCallback(async () => {
    setLoadError("");
    const { ok, json } = await api("/api/admin/cleanup");
    if (!ok) {
      setLoadError(json.error || "Could not look at the data.");
      return;
    }
    setData(json);
    setStudents(new Set<string>(json.students.filter((r: Row) => r.demo).map((r: Row) => r.id)));
    setTeachers(new Set<string>(json.teachers.filter((r: Row) => r.demo && !r.protected).map((r: Row) => r.id)));
    setNotices(new Set<string>(json.notices.filter((r: Row) => r.demo).map((r: Row) => r.id)));
    setAssignments(new Set<string>(json.assignments.filter((r: Row) => r.demo).map((r: Row) => r.id)));
    setExams(new Set<string>());
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
      await Promise.all([loadClasses(), loadCleanup()]);
      setReady(true);
    })();
  }, [router, loadClasses, loadCleanup]);

  async function createClasses() {
    setCBusy(true);
    setCMsg(null);
    const { ok, json } = await api("/api/admin/setup-classes", "POST");
    if (!ok) setCMsg({ type: "error", text: json.error || "Could not create the classes." });
    else {
      setCMsg({ type: "success", text: json.created ? `${json.created} classes created.` : "All 20 classes already exist." });
      await loadClasses();
    }
    setCBusy(false);
  }

  async function removeData() {
    const total = students.size + teachers.size + notices.size + assignments.size + exams.size;
    if (!window.confirm(`This permanently removes ${total} records and everything that belongs to them (attendance, marks, fees...). It cannot be undone. Continue?`)) return;
    setBusy(true);
    setError("");
    const { ok, json } = await api("/api/admin/cleanup", "POST", {
      confirm,
      student_ids: Array.from(students),
      teacher_ids: Array.from(teachers),
      notice_ids: Array.from(notices),
      assignment_ids: Array.from(assignments),
      exam_ids: Array.from(exams),
      delete_logins: deleteLogins,
      clear: { mcq: clearMcq, holidays: clearHolidays, cover: clearCover, audit: clearAudit },
    });
    if (!ok) setError(json.error || "Something went wrong.");
    else {
      setResult({ done: json.done || {}, problems: json.problems || [] });
      setConfirm("");
      await Promise.all([loadCleanup(), loadClasses()]);
    }
    setBusy(false);
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 240 }} /></div>;

  const missing = grid.reduce((a, g) => a + g.sections.filter((s: any) => !s.exists).length, 0);
  const total = students.size + teachers.size + notices.size + assignments.size + exams.size;
  const anyOption = clearMcq || clearHolidays || clearCover || clearAudit;
  const counts = data?.counts || {};

  return (
    <AdminLayout active="setup" fullName={fullName}>
      <h1 className="t-page-title">Setup &amp; Cleanup</h1>
      <p style={{ color: "var(--muted)", maxWidth: 700, marginTop: -6 }}>Get the portal ready for real use: set up the classes, then remove the sample data that was added for the presentation and for testing.</p>

      <div className="portal-panel">
        <h2>1. Classes: 6 to Matric, sections A to D</h2>
        <p style={{ marginTop: 0 }}>Matric is Class 10. That makes 20 classes in total.</p>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ maxWidth: 420 }}>
            <thead><tr><th>Class</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead>
            <tbody>
              {grid.map((g) => (
                <tr key={g.grade}>
                  <td><strong>{g.grade === "10" ? "10 (Matric)" : g.grade}</strong></td>
                  {g.sections.map((s: any) => <td key={s.section}>{s.exists ? <CheckCircle2 size={18} color="#2f6b4f" /> : <Circle size={18} color="#b0b8b3" />}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {otherClasses.length > 0 && <p className="t-hint">Other classes found (kept as they are): {otherClasses.join(", ")}</p>}
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={createClasses} disabled={cBusy || missing === 0}>
          {cBusy ? "Creating…" : missing === 0 ? "All 20 classes exist" : `Create the ${missing} missing classes`}
        </button>
        {cMsg && <p className={cMsg.type === "success" ? "success-text" : "error-text"} role="status">{cMsg.text}</p>}
      </div>

      <div className="portal-panel">
        <h2>2. Remove sample and test data</h2>
        <div className="att-banner hol" style={{ marginBottom: 14 }}>
          <span><strong>This cannot be undone.</strong> First download a copy under <Link href="/admin/backup" className="auth-link">Backup &amp; Export</Link>. Items marked <strong>Sample</strong> are the records from the presentation script and are ticked for you. Check every tick before you continue. Admin logins are never removed.</span>
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {data && (
          <>
            <Group title="Students" rows={data.students} picked={students} setPicked={setStudents} note="Removing a student also removes their attendance, marks and fees." render={(r) => <>{r.name} <span className="t-test-meta">· Class {r.class_name} · Roll {r.roll_no}{r.has_login ? " · has a login" : ""}</span></>} />
            <Group title="Teachers" rows={data.teachers} picked={teachers} setPicked={setTeachers} note="A staff record that belongs to an admin login can't be removed here." render={(r) => <>{r.name} <span className="t-test-meta">· {r.subject || "no subject"}{r.has_login ? " · has a login" : ""}{r.protected ? " · admin (kept)" : ""}</span></>} />
            <Group title="Notices" rows={data.notices} picked={notices} setPicked={setNotices} render={(r) => <>{r.title}</>} />
            <Group title="Homework (assignments)" rows={data.assignments} picked={assignments} setPicked={setAssignments} render={(r) => <>{r.title} <span className="t-test-meta">· {r.subject} · Class {r.class_name}</span></>} />
            <Group title="Tests and exams" rows={data.exams} picked={exams} setPicked={setExams} note="Tests created while trying out the portal. Nothing here is ticked for you." render={(r) => <>{r.name}{r.term ? <span className="t-test-meta"> · {r.term}</span> : null}</>} />

            <h3 style={{ fontSize: "1rem" }}>Also</h3>
            <label className="ed-check" style={{ display: "flex", gap: 8, margin: "6px 0" }}><input type="checkbox" checked={deleteLogins} onChange={(e) => setDeleteLogins(e.target.checked)} style={{ width: 18, height: 18 }} /> Delete the login accounts of the students and teachers removed above</label>
            {counts.mcq_questions !== null && <label style={{ display: "flex", gap: 8, margin: "6px 0" }}><input type="checkbox" checked={clearMcq} onChange={(e) => setClearMcq(e.target.checked)} style={{ width: 18, height: 18 }} /> Delete all MCQ questions and papers ({counts.mcq_questions} questions, {counts.mcq_papers} papers)</label>}
            {counts.holidays !== null && <label style={{ display: "flex", gap: 8, margin: "6px 0" }}><input type="checkbox" checked={clearHolidays} onChange={(e) => setClearHolidays(e.target.checked)} style={{ width: 18, height: 18 }} /> Delete all holidays ({counts.holidays})</label>}
            {counts.cover !== null && <label style={{ display: "flex", gap: 8, margin: "6px 0" }}><input type="checkbox" checked={clearCover} onChange={(e) => setClearCover(e.target.checked)} style={{ width: 18, height: 18 }} /> Delete all substitute cover entries ({counts.cover})</label>}
            {counts.audit_log !== null && <label style={{ display: "flex", gap: 8, margin: "6px 0" }}><input type="checkbox" checked={clearAudit} onChange={(e) => setClearAudit(e.target.checked)} style={{ width: 18, height: 18 }} /> Clear the Activity Log ({counts.audit_log} entries)</label>}

            <div className="form-field" style={{ maxWidth: 360, marginTop: 18 }}>
              <label htmlFor="cl_confirm">Type <strong>DELETE</strong> to confirm</label>
              <input id="cl_confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
            </div>
            <button className="btn btn-primary" style={{ background: "#b3261e", borderColor: "#b3261e" }} onClick={removeData} disabled={busy || confirm !== "DELETE" || (total === 0 && !anyOption)}>
              {busy ? "Removing…" : `Remove ${total} selected records`}
            </button>
            {error && <p className="error-text" role="alert">{error}</p>}
          </>
        )}
        {result && (
          <div style={{ marginTop: 16 }}>
            <p className="success-text">Done. Removed: {Object.entries(result.done).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing"}.</p>
            {result.problems.length > 0 && (
              <div>
                <p className="error-text" style={{ marginBottom: 4 }}>Some steps reported a problem:</p>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.82rem" }}>{result.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
