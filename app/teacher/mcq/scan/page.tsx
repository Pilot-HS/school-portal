"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Download, Save, Trash2 } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import McqSetupNotice from "@/components/McqSetupNotice";
import { teacherApi } from "@/lib/teacherApi";
import { questionsForVersion, PaperQuestion } from "@/lib/mcqShuffle";
import { scanOmr } from "@/lib/omrScan";
import { loadPhoto, overlayPicture } from "@/lib/omrBrowser";
import { classLabel } from "@/lib/teacherUi";

type Sheet = {
  id: number;
  name: string;
  ok: boolean;
  error?: string;
  roll: string;
  version: string;
  answers: string[];
  overlay: string;
  warnings: string[];
  editing?: boolean;
};

const stripZeros = (s: string) => s.replace(/^0+/, "");

export default function ScanPage() {
  const { classes, myClassIds } = useTeacher();
  const [papers, setPapers] = useState<any[]>([]);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [paperId, setPaperId] = useState("");
  const [paper, setPaper] = useState<any>(null);
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [students, setStudents] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [testId, setTestId] = useState("");
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { ok, data } = await teacherApi("/api/teacher/mcq-papers");
      if (!ok) {
        if (data.setup_needed) setSetupNeeded(true);
        else setMessage({ type: "error", text: data.error || "Could not load papers." });
      } else setPapers(data.papers || []);
    })();
  }, []);

  useEffect(() => {
    setSheets([]);
    setPaper(null);
    if (!paperId) return;
    (async () => {
      const { ok, data } = await teacherApi(`/api/teacher/mcq-papers?id=${paperId}`);
      if (ok) setPaper(data.paper);
    })();
  }, [paperId]);

  const loadClass = useCallback(async () => {
    setStudents([]);
    setTests([]);
    setTestId("");
    if (!classId) return;
    const [s, t] = await Promise.all([
      teacherApi(`/api/teacher/class-students?class_id=${classId}`),
      teacherApi(`/api/teacher/tests?class_id=${classId}`),
    ]);
    if (s.ok) setStudents(s.data.students || []);
    if (t.ok) setTests(t.data.tests || []);
  }, [classId]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  const questionCount: number = paper?.questions?.length || 0;
  const marksPer = Number(paper?.marks_per_question || 1);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files: File[] = Array.from((e.target.files || []) as ArrayLike<File>);
    e.target.value = "";
    if (!paper || files.length === 0) return;
    setScanning(true);
    setMessage(null);
    for (const file of files) {
      const id = Date.now() + Math.random();
      try {
        const { image, bitmap } = await loadPhoto(file);
        const res = scanOmr(image, questionCount);
        const overlay = res.ok ? overlayPicture(bitmap, image, res) : "";
        bitmap.close?.();
        setSheets((prev) => [
          ...prev,
          res.ok
            ? { id, name: file.name, ok: true, roll: res.roll, version: res.version, answers: res.answers, overlay, warnings: res.warnings }
            : { id, name: file.name, ok: false, error: res.error, roll: "", version: "", answers: [], overlay: "", warnings: [] },
        ]);
      } catch {
        setSheets((prev) => [...prev, { id, name: file.name, ok: false, error: "This photo couldn't be opened.", roll: "", version: "", answers: [], overlay: "", warnings: [] }]);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    setScanning(false);
  }

  const update = (id: number, patch: Partial<Sheet>) => setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const setAnswer = (id: number, i: number, v: string) =>
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, answers: s.answers.map((a, k) => (k === i ? v : a)) } : s)));

  type Graded = { sheet: Sheet; student: any | null; correct: number; wrong: number; blank: number; versionOk: boolean };
  const graded: Graded[] = useMemo(() => {
    return sheets.map((sheet) => {
      const rollKey = sheet.roll.includes("?") ? "" : stripZeros(sheet.roll);
      const student = rollKey ? students.find((st) => stripZeros(String(st.roll_no)) === rollKey) || null : null;
      const versionOk = ["A", "B", "C", "D"].includes(sheet.version);
      let correct = 0, wrong = 0, blank = 0;
      if (sheet.ok && paper && versionOk) {
        const key: PaperQuestion[] = questionsForVersion(paper.id, paper.questions, sheet.version);
        key.forEach((q, i) => {
          const a = sheet.answers[i] || "";
          if (!a || a === "*") blank++;
          else if (a === q.correct) correct++;
          else wrong++;
        });
      }
      return { sheet, student, correct, wrong, blank, versionOk };
    });
  }, [sheets, students, paper]);

  const selectedTest = tests.find((t) => t.id === testId);
  const markFor = (g: Graded) => (selectedTest ? Math.round((g.correct / Math.max(1, questionCount)) * Number(selectedTest.max_marks) * 100) / 100 : g.correct * marksPer);

  const savable = graded.filter((g) => g.sheet.ok && g.versionOk && g.student);
  const seen = new Set<string>();
  const uniqueSavable = savable.filter((g) => (seen.has(g.student.id) ? false : (seen.add(g.student.id), true)));

  async function saveToTest() {
    if (!selectedTest) return;
    setSaving(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/enter-results", {
      body: {
        exam_id: selectedTest.exam_id,
        class_id: selectedTest.class_id,
        subject_id: selectedTest.subject_id,
        records: uniqueSavable.map((g) => ({ student_id: g.student.id, marks_obtained: markFor(g) })),
      },
    });
    setMessage(ok ? { type: "success", text: `Marks saved for ${data.count} students.` } : { type: "error", text: data.error || "Could not save the marks." });
    setSaving(false);
  }

  function downloadCsv() {
    const rows = [["Roll", "Student", "Version", "Correct", "Wrong", "Blank", "Marks"]];
    graded.filter((g) => g.sheet.ok).forEach((g) =>
      rows.push([g.sheet.roll, g.student?.full_name || "Not matched", g.sheet.version, String(g.correct), String(g.wrong), String(g.blank), String(g.correct * marksPer)])
    );
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "omr-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (setupNeeded) return <div className="portal-main"><h1 className="t-page-title">Check OMR Sheets</h1><McqSetupNotice /></div>;

  return (
    <div className="portal-main">
      <h1 className="t-page-title">Check OMR Sheets</h1>

      <div className="portal-panel">
        <h2>1. Choose the paper and class</h2>
        <div className="t-form-grid">
          <div className="form-field">
            <label htmlFor="s_paper">Paper</label>
            <select id="s_paper" value={paperId} onChange={(e) => setPaperId(e.target.value)}>
              <option value="">Select a paper…</option>
              {papers.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.count} questions)</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s_class">Class</label>
            <ClassSelect id="s_class" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
          </div>
        </div>
        {papers.length === 0 && !setupNeeded && <p className="t-hint">You need a paper first. Make one under MCQ Papers.</p>}
      </div>

      <div className="portal-panel">
        <h2>2. Photograph the filled sheets</h2>
        <ul className="scan-tips">
          <li>Lay the sheet flat on a table, in good light, with no shadow across it.</li>
          <li>Hold the phone straight above it, upright (name at the top), with all four black corner squares in view.</li>
          <li>You can choose many photos at once.</li>
        </ul>
        <label className={`import-drop ${!paper || !classId ? "disabled" : ""}`}>
          <Camera size={22} />
          <span>{scanning ? "Reading the sheets…" : !paper ? "Choose a paper first" : "Tap to take or choose photos"}</span>
          <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={!paper || !classId || scanning} />
        </label>
      </div>

      {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}

      {graded.map((g, idx) => {
        const s = g.sheet;
        if (!s.ok) {
          return (
            <div className="portal-panel scan-card" key={s.id}>
              <div className="t-row-between"><strong>Sheet {idx + 1}</strong><button className="t-icon-btn danger" onClick={() => setSheets((p) => p.filter((x) => x.id !== s.id))} aria-label="Remove"><Trash2 size={16} /></button></div>
              <p className="error-text" style={{ marginBottom: 0 }}>{s.error}</p>
            </div>
          );
        }
        const flagged = s.answers.map((a, i) => ({ a, i })).filter((x) => x.a === "" || x.a === "*");
        return (
          <div className="portal-panel scan-card" key={s.id}>
            <div className="t-row-between">
              <strong>Sheet {idx + 1}{g.student ? ` — ${g.student.full_name}` : ""}</strong>
              <button className="t-icon-btn danger" onClick={() => setSheets((p) => p.filter((x) => x.id !== s.id))} aria-label="Remove sheet"><Trash2 size={16} /></button>
            </div>

            <div className="scan-fields">
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor={`roll${s.id}`}>Roll no.</label>
                <input id={`roll${s.id}`} inputMode="numeric" maxLength={3} value={s.roll} onChange={(e) => update(s.id, { roll: e.target.value.replace(/[^0-9?]/g, "") })} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor={`ver${s.id}`}>Version</label>
                <select id={`ver${s.id}`} value={["A", "B", "C", "D"].includes(s.version) ? s.version : ""} onChange={(e) => update(s.id, { version: e.target.value })}>
                  <option value="">Choose…</option>
                  {["A", "B", "C", "D"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>

            {!g.student && <p className="error-text" style={{ margin: "8px 0 0" }}>{s.roll.includes("?") ? "Roll number couldn't be read fully. Type it above." : `No student with roll number ${stripZeros(s.roll) || "?"} in ${classLabel(classes.find((c) => c.id === classId))}.`}</p>}
            {!g.versionOk && <p className="error-text" style={{ margin: "8px 0 0" }}>Version couldn&apos;t be read. Choose it above.</p>}
            {s.warnings.map((w) => <p key={w} className="error-text" style={{ margin: "8px 0 0" }}>{w}</p>)}

            {g.versionOk && (
              <div className="scan-score">
                <span className="pill pill-green">{g.correct} correct</span>{" "}
                <span className="pill pill-red">{g.wrong} wrong</span>{" "}
                <span className="pill pill-gray">{g.blank} blank / unclear</span>{" "}
                <strong style={{ marginLeft: 6 }}>{g.correct * marksPer} / {questionCount * marksPer}</strong>
              </div>
            )}

            {flagged.length > 0 && (
              <p className="t-hint">Please check: {flagged.map((f) => `Q${f.i + 1}${f.a === "*" ? " (two marks)" : " (blank)"}`).join(", ")}</p>
            )}

            <details>
              <summary className="auth-link" style={{ cursor: "pointer" }}>Check the photo and fix answers</summary>
              {s.overlay && <img className="scan-photo" src={s.overlay} alt={`Photo of sheet ${idx + 1} with green rings on the circles that were read as filled`} />}
              <p className="t-hint">Green rings show the circles that were read as filled. If a ring is missing or wrong, fix the answer below.</p>
              <div className="scan-answers">
                {s.answers.map((a, i) => (
                  <label key={i} className={a === "" || a === "*" ? "flag" : ""}>
                    <span>{i + 1}</span>
                    <select value={a} onChange={(e) => setAnswer(s.id, i, e.target.value)}>
                      <option value="">–</option>
                      {a === "*" && <option value="*">2 marks</option>}
                      {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          </div>
        );
      })}

      {graded.some((g) => g.sheet.ok) && (
        <div className="portal-panel">
          <h2>3. Save the marks</h2>
          <p style={{ marginTop: 0 }}>{uniqueSavable.length} of {graded.filter((g) => g.sheet.ok).length} sheets are ready (student matched and version known).</p>
          {savable.length !== uniqueSavable.length && <p className="error-text">Two sheets have the same roll number. Only the first one will be saved.</p>}
          <div className="form-field" style={{ maxWidth: 420 }}>
            <label htmlFor="s_test">Save into this test (optional)</label>
            <select id="s_test" value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">Don&apos;t save — just show results</option>
              {tests.map((t) => <option key={t.id} value={t.id}>{t.exams?.name} · {t.subjects?.name} ({t.max_marks} marks)</option>)}
            </select>
          </div>
          {selectedTest && <p className="t-hint" style={{ marginTop: 0 }}>Marks are scaled to the test&apos;s {selectedTest.max_marks} marks. Create the test first under Tests if it isn&apos;t listed.</p>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="btn btn-primary" onClick={saveToTest} disabled={!selectedTest || saving || uniqueSavable.length === 0}><Save size={15} /> {saving ? "Saving…" : "Save marks to test"}</button>
            <button className="btn btn-outline" onClick={downloadCsv}><Download size={15} /> Download results (CSV)</button>
          </div>

          <div style={{ overflowX: "auto", marginTop: 16 }}>
            <table className="data-table">
              <thead><tr><th>Roll</th><th>Student</th><th>Ver.</th><th>Correct</th><th>Marks</th></tr></thead>
              <tbody>
                {graded.filter((g) => g.sheet.ok).map((g) => (
                  <tr key={g.sheet.id}>
                    <td>{g.sheet.roll}</td>
                    <td>{g.student?.full_name || <span style={{ color: "#a13636" }}>Not matched</span>}</td>
                    <td>{g.sheet.version || "—"}</td>
                    <td>{g.versionOk ? `${g.correct}/${questionCount}` : "—"}</td>
                    <td>{g.versionOk ? markFor(g) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
