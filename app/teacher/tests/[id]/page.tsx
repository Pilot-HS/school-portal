"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { teacherApi } from "@/lib/teacherApi";
import { classLabel, formatDate } from "@/lib/teacherUi";

export default function TestMarksPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [test, setTest] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await teacherApi(`/api/teacher/test-detail?id=${id}`);
    if (!ok) {
      setLoadError(data.error || "Could not load this test.");
      setLoading(false);
      return;
    }
    setTest(data.test);
    setStudents(data.students || []);
    const initial: Record<string, string> = {};
    (data.students || []).forEach((s: any) => {
      if (s.marks_obtained !== null && s.marks_obtained !== undefined) initial[s.id] = String(s.marks_obtained);
    });
    setMarks(initial);
    setLoading(false);
  }

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 300 }} /></div>;

  if (loadError || !test) {
    return (
      <div className="portal-main">
        <Link href="/teacher/tests" className="t-back"><ArrowLeft size={15} /> All tests</Link>
        <div className="t-error" role="alert"><span>{loadError || "Test not found."}</span></div>
      </div>
    );
  }

  const max = Number(test.max_marks);
  const isInvalid = (v: string | undefined) => {
    if (v === undefined || v === "") return false;
    const n = Number(v);
    return !Number.isFinite(n) || n < 0 || n > max;
  };
  const entered = students.filter((s) => marks[s.id] !== undefined && marks[s.id] !== "" && !isInvalid(marks[s.id]));
  const values = entered.map((s) => Number(marks[s.id]));
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const highest = values.length ? Math.max(...values) : null;
  const lowest = values.length ? Math.min(...values) : null;
  const anyInvalid = students.some((s) => isInvalid(marks[s.id]));
  const hasSavedMarks = students.some((s) => s.marks_obtained !== null && s.marks_obtained !== undefined);

  async function save() {
    setMessage(null);
    if (anyInvalid) {
      setMessage({ type: "error", text: `Some marks are not valid. Each mark must be between 0 and ${max}.` });
      return;
    }
    if (entered.length === 0) {
      setMessage({ type: "error", text: "Enter at least one student's marks." });
      return;
    }
    setSaving(true);
    const { ok, data } = await teacherApi("/api/teacher/enter-results", {
      body: {
        exam_id: test.exam_id,
        class_id: test.class_id,
        subject_id: test.subject_id,
        records: entered.map((s) => ({ student_id: s.id, marks_obtained: Number(marks[s.id]) })),
      },
    });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Something went wrong. Please try again." });
    } else {
      setMessage({ type: "success", text: `Marks saved for ${data.count} students.` });
      // refresh so the "saved" state is up to date
      setStudents((prev) => prev.map((s) => (marks[s.id] !== undefined && marks[s.id] !== "" ? { ...s, marks_obtained: Number(marks[s.id]) } : s)));
    }
    setSaving(false);
  }

  async function removeTest() {
    if (!window.confirm("Delete this test? This can't be undone.")) return;
    setDeleting(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/delete-test", { body: { id } });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not delete this test." });
      setDeleting(false);
      return;
    }
    router.push("/teacher/tests");
  }

  const fmt = (n: number | null) => (n === null ? "—" : Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <div className="portal-main">
      <Link href="/teacher/tests" className="t-back"><ArrowLeft size={15} /> All tests</Link>
      <h1 className="t-page-title" style={{ marginTop: 8 }}>{test.exams?.name}</h1>
      <p className="t-test-meta" style={{ marginTop: -6, marginBottom: 18 }}>
        {test.subjects?.name} · Class {classLabel(test.classes)} · {max} marks
        {test.exams?.start_date ? ` · ${formatDate(test.exams.start_date)}` : ""}
        {test.exams?.term ? ` · ${test.exams.term}` : ""}
      </p>

      <div className="t-stats">
        <div className="t-stat"><div><div className="t-stat-num">{entered.length}/{students.length}</div><div className="t-stat-label">Marks entered</div></div></div>
        <div className="t-stat"><div><div className="t-stat-num">{fmt(average)}</div><div className="t-stat-label">Class average</div></div></div>
        <div className="t-stat"><div><div className="t-stat-num">{fmt(highest)}</div><div className="t-stat-label">Highest</div></div></div>
        <div className="t-stat"><div><div className="t-stat-num">{fmt(lowest)}</div><div className="t-stat-label">Lowest</div></div></div>
      </div>

      <div className="portal-panel">
        <h2>Marks</h2>
        {students.length === 0 ? (
          <div className="t-empty">No students in this class yet.</div>
        ) : (
          students.map((s) => {
            const v = marks[s.id] ?? "";
            const bad = isInvalid(v);
            const pct = v !== "" && !bad ? Math.round((Number(v) / max) * 100) : null;
            return (
              <div className="att-row" key={s.id}>
                <div className="att-roll">{s.roll_no}</div>
                <div className="att-name">{s.full_name}</div>
                <div className="mark-box">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={max}
                    step="any"
                    aria-label={`Marks for ${s.full_name}`}
                    className={bad ? "bad" : ""}
                    value={v}
                    placeholder="—"
                    onChange={(e) => setMarks((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                  <span className="mark-pct">{bad ? `max ${max}` : pct !== null ? `${pct}%` : `/ ${max}`}</span>
                </div>
              </div>
            );
          })
        )}
        <p className="t-hint">Leaving a box empty does not remove marks that were saved before.</p>
      </div>

      <div className="att-bar">
        <button className="btn btn-outline" onClick={removeTest} disabled={deleting || hasSavedMarks} title={hasSavedMarks ? "Tests with saved marks can't be deleted here" : "Delete this test"}>
          <Trash2 size={15} /> Delete
        </button>
        <button className="btn btn-primary" onClick={save} disabled={saving || students.length === 0}>
          {saving ? "Saving…" : "Save Marks"}
        </button>
      </div>
      {message && (
        <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>
      )}
    </div>
  );
}
