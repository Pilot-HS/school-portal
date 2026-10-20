"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";
import ClassSelect from "@/components/ClassSelect";
import ReportCard, { RcBand, RcStudent, examKeysOf } from "@/components/ReportCard";
import { teacherApi } from "@/lib/teacherApi";

// Pick a class, choose which exams to include, add optional remarks and print every card.
export default function ReportCardsTool({ classes, myClassIds }: { classes: any[]; myClassIds: string[] }) {
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [students, setStudents] = useState<RcStudent[]>([]);
  const [bands, setBands] = useState<RcBand[]>([]);
  const [year, setYear] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [exams, setExams] = useState<string[]>([]);
  const [chosenExams, setChosenExams] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState("");

  const load = useCallback(async () => {
    setStudents([]);
    setError("");
    if (!classId) return;
    setLoading(true);
    const { ok, data } = await teacherApi(`/api/report-card?class_id=${classId}`);
    if (!ok) {
      setError(data.error || "Could not load report cards.");
      setLoading(false);
      return;
    }
    const list: RcStudent[] = data.students || [];
    setStudents(list);
    setBands(data.bands || []);
    setYear(data.year_label || "");
    const keys: string[] = Array.from(new Set<string>(list.flatMap((s) => examKeysOf(s)))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    setExams(keys);
    setChosenExams(keys);
    const p: Record<string, boolean> = {};
    list.forEach((s) => (p[s.id] = true));
    setPicked(p);
    setRemarks({});
    setPreviewId(list[0]?.id || "");
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => students.filter((s) => picked[s.id]), [students, picked]);
  const preview = students.find((s) => s.id === previewId);

  const toggleExam = (k: string) => setChosenExams((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));

  return (
    <>
      <div className="no-print">
        <div className="portal-panel">
          <div className="form-field" style={{ maxWidth: 360 }}>
            <label htmlFor="rc_class">Class</label>
            <ClassSelect id="rc_class" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
          </div>
          {exams.length > 0 && (
            <div>
              <div className="t-hint" style={{ marginTop: 0 }}>Include these exams on the card:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {exams.map((k) => (
                  <label key={k} className={`rc-chip ${chosenExams.includes(k) ? "on" : ""}`}>
                    <input type="checkbox" checked={chosenExams.includes(k)} onChange={() => toggleExam(k)} /> {k}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && <div className="t-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}
        {loading && <div className="skeleton" style={{ height: 200 }} />}

        {!loading && classId && students.length === 0 && !error && <div className="portal-panel"><div className="t-empty">No students in this class yet.</div></div>}

        {students.length > 0 && (
          <div className="portal-panel">
            <div className="t-row-between" style={{ flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>{selected.length} of {students.length} students selected</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => setPicked(Object.fromEntries(students.map((s) => [s.id, true])))}>All</button>
                <button className="btn btn-outline" onClick={() => setPicked({})}>None</button>
                <button className="btn btn-primary" onClick={() => window.print()} disabled={selected.length === 0}><Printer size={15} /> Print {selected.length} cards</button>
              </div>
            </div>
            <p className="t-hint" style={{ marginTop: 0 }}>To save as PDF, choose &ldquo;Save as PDF&rdquo; in the print window. The remark is optional; if left empty, one is written automatically from the marks.</p>
            {students.map((s) => (
              <div className="rc-row" key={s.id}>
                <label className="rc-pick">
                  <input type="checkbox" checked={!!picked[s.id]} onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))} />
                  <span className="att-roll">{s.roll_no}</span>
                  <span className="att-name">{s.full_name}</span>
                </label>
                <input className="rc-remark-input" aria-label={`Remark for ${s.full_name}`} placeholder="Remark (optional)" value={remarks[s.id] || ""} onChange={(e) => setRemarks((r) => ({ ...r, [s.id]: e.target.value }))} />
                <button className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "0.8rem" }} onClick={() => { setPreviewId(s.id); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Preview</button>
              </div>
            ))}
          </div>
        )}

        {preview && (
          <div style={{ marginBottom: 20 }}>
            <h2 className="t-section-title">Preview &mdash; {preview.full_name}</h2>
            <div className="rc-preview">
              <ReportCard student={preview} bands={bands} yearLabel={year} remark={remarks[preview.id]} includeExams={chosenExams} />
            </div>
          </div>
        )}
      </div>

      <div className="print-only">
        {selected.map((s) => (
          <ReportCard key={s.id} student={s} bands={bands} yearLabel={year} remark={remarks[s.id]} includeExams={chosenExams} />
        ))}
      </div>
    </>
  );
}
