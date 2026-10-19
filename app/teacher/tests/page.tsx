"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronRight, FileText, X } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";
import { classLabel, localISODate, formatDate } from "@/lib/teacherUi";

export default function TestsPage() {
  const router = useRouter();
  const { classes, myClassIds, teacher } = useTeacher();

  const [filterClass, setFilterClass] = useState("");
  const [tests, setTests] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [subjectId, setSubjectId] = useState("");
  const [maxMarks, setMaxMarks] = useState("20");
  const [date, setDate] = useState(localISODate());
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const { ok, data } = await teacherApi(`/api/teacher/tests${filterClass ? `?class_id=${filterClass}` : ""}`);
    if (!ok) {
      setLoadError(data.error || "Could not load tests.");
    } else {
      setTests(data.tests || []);
      setSubjects(data.subjects || []);
    }
    setLoading(false);
  }, [filterClass]);

  useEffect(() => {
    load();
  }, [load]);

  // Pre-select the teacher's own subject in the form when possible
  useEffect(() => {
    if (!subjectId && teacher?.subject && subjects.length > 0) {
      const match = subjects.find((s) => String(s.name).toLowerCase() === String(teacher.subject).toLowerCase());
      if (match) setSubjectId(match.id);
    }
  }, [subjects, teacher, subjectId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError("");
    const { ok, data } = await teacherApi("/api/teacher/create-test", {
      body: { name, class_id: classId, subject_id: subjectId, max_marks: Number(maxMarks), date, term },
    });
    if (!ok) {
      setFormError(data.error || "Something went wrong. Please try again.");
      setCreating(false);
      return;
    }
    router.push(`/teacher/tests/${data.id}`);
  }

  return (
    <div className="portal-main">
      <div className="t-row-between" style={{ marginBottom: 16 }}>
        <h1 className="t-page-title" style={{ margin: 0 }}>Tests &amp; Exams</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <><X size={15} /> Close</> : <><Plus size={15} /> New test</>}
        </button>
      </div>

      {showForm && (
        <div className="portal-panel">
          <h2>Create a test</h2>
          <form onSubmit={handleCreate}>
            <div className="t-form-grid">
              <div className="form-field">
                <label htmlFor="t_name">Test name</label>
                <input id="t_name" required placeholder="e.g. Unit Test 1" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="t_class">Class</label>
                <ClassSelect id="t_class" required value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
              </div>
              <div className="form-field">
                <label htmlFor="t_subject">Subject</label>
                <select id="t_subject" required value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  <option value="">Select a subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="t_marks">Total marks</label>
                <input id="t_marks" type="number" required min={1} max={1000} inputMode="numeric" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="t_date">Test date</label>
                <input id="t_date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="t_term">Term (optional)</label>
                <input id="t_term" placeholder="e.g. Term 1" value={term} onChange={(e) => setTerm(e.target.value)} />
              </div>
            </div>
            {subjects.length === 0 && !loading && (
              <p className="error-text">No subjects have been added yet. Ask the admin to add subjects first.</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={creating || subjects.length === 0}>
              {creating ? "Creating…" : "Create & enter marks"}
            </button>
            {formError && <p className="error-text" role="alert">{formError}</p>}
          </form>
        </div>
      )}

      <div className="portal-panel" style={{ paddingBottom: 6 }}>
        <div className="form-field" style={{ maxWidth: 320, marginBottom: 12 }}>
          <label htmlFor="filter_class">Show tests for</label>
          <ClassSelect id="filter_class" value={filterClass} onChange={setFilterClass} classes={classes} myClassIds={myClassIds} placeholder="All classes" />
        </div>
      </div>

      {loadError && (
        <div className="t-error" role="alert">
          <span>{loadError}</span>
          <button className="btn btn-outline" onClick={load}>Try again</button>
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : tests.length === 0 ? (
        <div className="portal-panel">
          <div className="t-empty">
            <FileText size={28} />
            No tests yet. Tap &ldquo;New test&rdquo; to create your first one.
          </div>
        </div>
      ) : (
        <div className="t-list">
          {tests.map((t) => (
            <Link key={t.id} href={`/teacher/tests/${t.id}`} className="t-test-card">
              <div className="icon-badge icon-badge-blue" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                <FileText size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="t-test-name">{t.exams?.name || "Test"}</div>
                <div className="t-test-meta">
                  {t.subjects?.name || "—"} · Class {classLabel(t.classes)} · {t.max_marks} marks
                  {t.exams?.start_date ? ` · ${formatDate(t.exams.start_date)}` : ""}
                </div>
              </div>
              <ChevronRight size={18} className="t-action-arrow" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
