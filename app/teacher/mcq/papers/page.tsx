"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, FileText, ChevronRight, Shuffle } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import McqSetupNotice from "@/components/McqSetupNotice";
import { teacherApi } from "@/lib/teacherApi";
import { formatDate } from "@/lib/teacherUi";

const DEFAULT_INSTRUCTIONS = "Choose the one correct answer for each question and fill its circle on the OMR sheet. Do not make any marks on this paper.";

export default function PapersPage() {
  const router = useRouter();
  const { classes, myClassIds, teacher } = useTeacher();
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [subjectId, setSubjectId] = useState("");
  const [duration, setDuration] = useState("30");
  const [marks, setMarks] = useState("1");
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [pool, setPool] = useState<any[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [randomN, setRandomN] = useState("20");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const loadPapers = useCallback(async () => {
    setLoading(true);
    const { ok, data } = await teacherApi("/api/teacher/mcq-papers");
    if (!ok) {
      if (data.setup_needed) setSetupNeeded(true);
      else setLoadError(data.error || "Could not load papers.");
    } else {
      setPapers(data.papers || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // Questions to choose from (for the chosen subject / class)
  const loadPool = useCallback(async () => {
    if (!showForm) return;
    setPoolLoading(true);
    const params = new URLSearchParams();
    if (subjectId) params.set("subject_id", subjectId);
    if (classId) params.set("class_id", classId);
    const { ok, data } = await teacherApi(`/api/teacher/mcq-questions?${params.toString()}`);
    if (ok) {
      setPool(data.questions || []);
      setSubjects(data.subjects || []);
    }
    setPoolLoading(false);
  }, [showForm, subjectId, classId]);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  useEffect(() => {
    if (!subjectId && teacher?.subject && subjects.length > 0) {
      const m = subjects.find((s) => String(s.name).toLowerCase() === String(teacher.subject).toLowerCase());
      if (m) setSubjectId(m.id);
    }
  }, [subjects, teacher, subjectId]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? pool.filter((p) => String(p.question_text).toLowerCase().includes(q)) : pool;
  }, [pool, search]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 100 ? s : [...s, id]));

  function pickRandom() {
    const n = Math.max(1, Math.min(100, Number(randomN) || 0));
    const ids = shown.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setSelected(ids.slice(0, n));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (selected.length === 0) {
      setFormError("Choose at least one question.");
      return;
    }
    setCreating(true);
    const { ok, data } = await teacherApi("/api/teacher/mcq-papers", {
      body: { title, class_id: classId || null, subject_id: subjectId || null, duration_minutes: Number(duration) || null, marks_per_question: Number(marks), instructions, question_ids: selected },
    });
    if (!ok) {
      setFormError(data.error || "Could not create the paper.");
      setCreating(false);
      return;
    }
    router.push(`/teacher/mcq/papers/${data.id}`);
  }

  if (setupNeeded) return <div className="portal-main"><h1 className="t-page-title">Papers</h1><McqSetupNotice /></div>;

  return (
    <div className="portal-main">
      <div className="t-row-between" style={{ marginBottom: 16 }}>
        <h1 className="t-page-title" style={{ margin: 0 }}>MCQ Papers</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <><X size={15} /> Close</> : <><Plus size={15} /> New paper</>}
        </button>
      </div>

      {showForm && (
        <form className="portal-panel" onSubmit={create}>
          <h2>Make a paper</h2>
          <div className="form-field">
            <label htmlFor="p_title">Title</label>
            <input id="p_title" required placeholder="e.g. Mathematics MCQ Test 1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="t-form-grid">
            <div className="form-field">
              <label htmlFor="p_subject">Subject</label>
              <select id="p_subject" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setSelected([]); }}>
                <option value="">Any subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="p_class">Class</label>
              <ClassSelect id="p_class" value={classId} onChange={(v) => { setClassId(v); setSelected([]); }} classes={classes} myClassIds={myClassIds} placeholder="Any class" />
            </div>
            <div className="form-field">
              <label htmlFor="p_marks">Marks per question</label>
              <input id="p_marks" type="number" min={0.5} step="0.5" required value={marks} onChange={(e) => setMarks(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="p_dur">Time allowed (minutes)</label>
              <input id="p_dur" type="number" min={1} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="p_ins">Instructions on the paper</label>
            <textarea id="p_ins" className="t-textarea" rows={2} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          </div>

          <h2 style={{ marginTop: 18 }}>Choose questions <span className="pill pill-green">{selected.length} chosen</span></h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
            <input aria-label="Search questions" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mcq-search" />
            <button type="button" className="btn btn-outline" onClick={() => setSelected(shown.slice(0, 100).map((p) => p.id))}>Select all shown</button>
            <button type="button" className="btn btn-outline" onClick={() => setSelected([])}>Clear</button>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <input aria-label="How many random questions" type="number" min={1} max={100} value={randomN} onChange={(e) => setRandomN(e.target.value)} className="mcq-num" />
              <button type="button" className="btn btn-outline" onClick={pickRandom}><Shuffle size={15} /> Pick random</button>
            </span>
          </div>
          {poolLoading ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : shown.length === 0 ? (
            <div className="t-empty">No questions match. Add some in the <Link href="/teacher/mcq/questions" className="auth-link">Question Bank</Link>.</div>
          ) : (
            <div className="mcq-pick">
              {shown.map((p) => {
                const idx = selected.indexOf(p.id);
                return (
                  <label key={p.id} className={`mcq-pick-row ${idx >= 0 ? "on" : ""}`}>
                    <input type="checkbox" checked={idx >= 0} onChange={() => toggle(p.id)} />
                    <span className="mcq-pick-no">{idx >= 0 ? idx + 1 : ""}</span>
                    <span>{p.question_text}</span>
                  </label>
                );
              })}
            </div>
          )}
          {formError && <p className="error-text" role="alert">{formError}</p>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 14 }} disabled={creating}>{creating ? "Creating…" : `Create paper (${selected.length} questions)`}</button>
        </form>
      )}

      {loadError && <div className="t-error" role="alert"><span>{loadError}</span></div>}
      {loading ? (
        <div className="skeleton" style={{ height: 160 }} />
      ) : papers.length === 0 ? (
        <div className="portal-panel"><div className="t-empty"><FileText size={28} />No papers yet. Tap &ldquo;New paper&rdquo;.</div></div>
      ) : (
        <div className="t-list">
          {papers.map((p) => (
            <Link key={p.id} href={`/teacher/mcq/papers/${p.id}`} className="t-test-card">
              <div className="icon-badge icon-badge-green" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}><FileText size={20} /></div>
              <div style={{ minWidth: 0 }}>
                <div className="t-test-name">{p.title}</div>
                <div className="t-test-meta">{[p.subject_name, p.class_name && `Class ${p.class_name}`, `${p.count} questions`, formatDate(p.created_at)].filter(Boolean).join(" · ")}</div>
              </div>
              <ChevronRight size={18} className="t-action-arrow" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
