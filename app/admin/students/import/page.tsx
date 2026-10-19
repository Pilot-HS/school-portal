"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Download, Upload, FileSpreadsheet, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { readSpreadsheet, toStudentRecords, StudentImportRecord } from "@/lib/readSpreadsheet";

type RowResult = { row: number; name: string; roll_no: string; class_name: string; status: "ok" | "error"; message?: string };
type Summary = { total: number; ok: number; errors: number; imported: number };

export default function ImportStudentsPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");

  const [fileName, setFileName] = useState("");
  const [records, setRecords] = useState<StudentImportRecord[]>([]);
  const [results, setResults] = useState<RowResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

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

  async function callApi(rows: StudentImportRecord[], dryRun: boolean) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/import-students", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
      body: JSON.stringify({ rows, dry_run: dryRun }),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  }

  function reset() {
    setFileName("");
    setRecords([]);
    setResults([]);
    setSummary(null);
    setDone(false);
    setError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setResults([]);
    setSummary(null);
    setDone(false);
    setFileName(file.name);
    setChecking(true);
    try {
      const rows = await readSpreadsheet(file);
      const { records: recs, missing } = toStudentRecords(rows);
      if (missing.length > 0) {
        setError(`These column titles are missing from the file: ${missing.join(", ")}. Please use the template without changing the titles.`);
        setRecords([]);
        setChecking(false);
        return;
      }
      if (recs.length === 0) {
        setError("The file has no student rows. Add students starting from row 2.");
        setRecords([]);
        setChecking(false);
        return;
      }
      setRecords(recs);
      const { ok, json } = await callApi(recs, true);
      if (!ok) {
        setError(json.error || "Could not check the file. Please try again.");
      } else {
        setResults(json.results);
        setSummary(json.summary);
      }
    } catch (err: any) {
      setError(err?.message || "This file couldn't be read. Please use the template.");
      setRecords([]);
    }
    setChecking(false);
  }

  async function handleImport() {
    if (!summary || summary.ok === 0) return;
    setImporting(true);
    setError("");
    const { ok, json } = await callApi(records, false);
    if (!ok) {
      setError(json.error || "Import failed. Nothing was changed. Please try again.");
    } else {
      setResults(json.results);
      setSummary(json.summary);
      setDone(true);
    }
    setImporting(false);
  }

  if (!ready) {
    return (
      <div className="skeleton-wrap" aria-busy="true">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const problems = results.filter((r) => r.status === "error");

  return (
    <AdminLayout active="students" fullName={fullName}>
      <Link href="/admin/students" className="t-back"><ArrowLeft size={15} /> Students</Link>
      <h1 className="t-page-title" style={{ marginTop: 8 }}>Import Students from a File</h1>

      <div className="portal-panel">
        <h2>Step 1 &mdash; Download the template</h2>
        <p style={{ marginTop: 0 }}>
          Fill in one student per row. Full Name, Roll No and Class are required. The sheet named
          &ldquo;Instructions&rdquo; explains every column.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn btn-primary" href="/student-import-template.xlsx" download>
            <Download size={15} /> Excel template (.xlsx)
          </a>
          <a className="btn btn-outline" href="/student-import-template.csv" download>
            <FileSpreadsheet size={15} /> CSV template
          </a>
        </div>
      </div>

      <div className="portal-panel">
        <h2>Step 2 &mdash; Upload your filled file</h2>
        <p style={{ marginTop: 0 }}>You&apos;ll see a preview first. Nothing is saved until you press Import.</p>
        <label className="import-drop">
          <Upload size={22} />
          <span>{fileName || "Tap to choose an Excel or CSV file"}</span>
          <input ref={fileInput} type="file" accept=".xlsx,.csv,.txt" onChange={handleFile} disabled={checking || importing} />
        </label>
        {checking && <p className="t-hint">Checking your file&hellip;</p>}
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>

      {summary && (
        <div className="portal-panel">
          {done ? (
            <div className="import-done">
              <CheckCircle2 size={28} />
              <div>
                <h2 style={{ margin: 0 }}>{summary.imported} {summary.imported === 1 ? "student" : "students"} added</h2>
                {summary.errors > 0 && <p style={{ margin: "4px 0 0" }}>{summary.errors} {summary.errors === 1 ? "row was" : "rows were"} skipped. See below.</p>}
              </div>
            </div>
          ) : (
            <>
              <h2>Step 3 &mdash; Check and import</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <span className="pill pill-green">{summary.ok} ready</span>
                <span className={`pill ${summary.errors > 0 ? "pill-red" : "pill-gray"}`}>{summary.errors} with problems</span>
              </div>
              {summary.errors > 0 && summary.ok > 0 && (
                <p className="t-hint" style={{ marginTop: 0 }}>Rows with problems will be skipped. Fix them in your file and upload it again if you want them added.</p>
              )}
              {summary.ok === 0 && <p className="error-text" style={{ marginTop: 0 }}>No row can be imported yet. Fix the problems below and upload the file again.</p>}
            </>
          )}

          {(done ? problems : results).length > 0 && (
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto", marginTop: 8 }}>
              <table className="data-table">
                <thead><tr><th>Row</th><th>Name</th><th>Roll</th><th>Class</th><th>Result</th></tr></thead>
                <tbody>
                  {(done ? problems : results).map((r) => (
                    <tr key={r.row + r.name}>
                      <td>{r.row}</td>
                      <td>{r.name || "—"}</td>
                      <td>{r.roll_no || "—"}</td>
                      <td>{r.class_name || "—"}</td>
                      <td>
                        {r.status === "ok" ? (
                          <span className="pill pill-green">{done ? "Added" : "Ready"}</span>
                        ) : (
                          <span style={{ color: "#a13636", fontSize: "0.82rem" }}>{r.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {done ? (
              <>
                <Link href="/admin/students" className="btn btn-primary">View students</Link>
                <button className="btn btn-outline" onClick={reset}>Import another file</button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleImport} disabled={importing || summary.ok === 0}>
                  {importing ? "Importing…" : `Import ${summary.ok} ${summary.ok === 1 ? "student" : "students"}`}
                </button>
                <button className="btn btn-outline" onClick={reset} disabled={importing}>Start over</button>
              </>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
