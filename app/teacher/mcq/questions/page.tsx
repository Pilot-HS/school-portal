"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, ClipboardPaste } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import McqSetupNotice from "@/components/McqSetupNotice";
import { teacherApi } from "@/lib/teacherApi";
import { parseMcqText } from "@/lib/mcqParse";
import { classLabel } from "@/lib/teacherUi";

const EMPTY = { question_text: "", option_a: "", option_b: "", option_c: "", option_d: "", correct_option: "A", topic: "" };

export default function QuestionBankPage() {
  const { role, userId, classes, myClassIds } = useTeacher();
  const [questions, setQuestions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [fClass, setFClass] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fSearch, setFSearch] = useState("");

  const [mode, setMode] = useState<"none" | "add" | "edit" | "bulk">("none");
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState({ ...EMPTY });
  const [formClass, setFormClass] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams();
    if (fClass) params.set("class_id", fClass);
    if (fSubject) params.set("subject_id", fSubject);
    if (fSearch.trim()) params.set("q", fSearch.trim());
    const { ok, data } = await teacherApi(`/api/teacher/mcq-questions?${params.toString()}`);
    if (!ok) {
      if (data.setup_needed) setSetupNeeded(true);
      else setLoadError(data.error || "Could not load questions.");
    } else {
      setSetupNeeded(false);
      setQuestions(data.questions || []);
      setSubjects(data.subjects || []);
    }
    setLoading(false);
  }, [fClass, fSubject, fSearch]);

  useEffect(() => {
    const t = setTimeout(load, fSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, fSearch]);

  function openAdd() {
    setMode("add");
    setEditId("");
    setForm({ ...EMPTY });
    setFormClass(fClass);
    setFormSubject(fSubject);
    setMessage(null);
  }
  function openEdit(q: any) {
    setMode("edit");
    setEditId(q.id);
    setForm({ question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, correct_option: q.correct_option, topic: q.topic || "" });
    setFormClass(q.class_id || "");
    setFormSubject(q.subject_id || "");
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveOne(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const payload = { ...form, class_id: formClass || null, subject_id: formSubject || null };
    const { ok, data } =
      mode === "edit"
        ? await teacherApi("/api/teacher/mcq-questions", { method: "PATCH", body: { id: editId, ...payload } })
        : await teacherApi("/api/teacher/mcq-questions", { body: { questions: [payload] } });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not save the question." });
    } else {
      setMessage({ type: "success", text: mode === "edit" ? "Question updated." : "Question added." });
      if (mode === "edit") setMode("none");
      else setForm({ ...EMPTY });
      await load();
    }
    setBusy(false);
  }

  const parsed = mode === "bulk" ? parseMcqText(bulkText) : { questions: [], problems: [] };

  async function saveBulk() {
    setBusy(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/mcq-questions", {
      body: { questions: parsed.questions.map((q) => ({ ...q, class_id: formClass || null, subject_id: formSubject || null })) },
    });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not save the questions." });
    } else {
      setMessage({ type: "success", text: `${data.count} questions added.` });
      setBulkText("");
      setMode("none");
      await load();
    }
    setBusy(false);
  }

  async function remove(q: any) {
    if (!window.confirm("Delete this question? Papers already made keep their own copy.")) return;
    const { ok, data } = await teacherApi("/api/teacher/mcq-questions", { method: "DELETE", body: { id: q.id } });
    if (!ok) setMessage({ type: "error", text: data.error || "Could not delete." });
    else {
      setMessage({ type: "success", text: "Question deleted." });
      await load();
    }
  }

  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name || "";
  const className = (id: string) => classLabel(classes.find((c) => c.id === id));

  if (setupNeeded) {
    return <div className="portal-main"><h1 className="t-page-title">Question Bank</h1><McqSetupNotice /></div>;
  }

  return (
    <div className="portal-main">
      <div className="t-row-between" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <h1 className="t-page-title" style={{ margin: 0 }}>Question Bank</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline" onClick={() => { setMode(mode === "bulk" ? "none" : "bulk"); setFormClass(fClass); setFormSubject(fSubject); setMessage(null); }}>
            <ClipboardPaste size={15} /> Paste many
          </button>
          <button className="btn btn-primary" onClick={() => (mode === "add" ? setMode("none") : openAdd())}>
            {mode === "add" ? <><X size={15} /> Close</> : <><Plus size={15} /> Add question</>}
          </button>
        </div>
      </div>

      {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status" style={{ marginTop: 0 }}>{message.text}</p>}

      {(mode === "add" || mode === "edit") && (
        <form className="portal-panel" onSubmit={saveOne}>
          <h2>{mode === "edit" ? "Edit question" : "New question"}</h2>
          <div className="t-form-grid">
            <div className="form-field">
              <label htmlFor="f_subject">Subject</label>
              <select id="f_subject" value={formSubject} onChange={(e) => setFormSubject(e.target.value)}>
                <option value="">Any subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="f_class">Class</label>
              <ClassSelect id="f_class" value={formClass} onChange={setFormClass} classes={classes} myClassIds={myClassIds} placeholder="Any class" />
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="f_q">Question</label>
            <textarea id="f_q" className="t-textarea" rows={2} required value={form.question_text} onChange={(e) => setForm({ ...form, question_text: e.target.value })} />
          </div>
          <div className="t-form-grid">
            {(["a", "b", "c", "d"] as const).map((k) => (
              <div className="form-field" key={k}>
                <label htmlFor={`f_${k}`}>Option {k.toUpperCase()}</label>
                <input id={`f_${k}`} required value={(form as any)[`option_${k}`]} onChange={(e) => setForm({ ...form, [`option_${k}`]: e.target.value })} />
              </div>
            ))}
            <div className="form-field">
              <label htmlFor="f_correct">Correct answer</label>
              <select id="f_correct" value={form.correct_option} onChange={(e) => setForm({ ...form, correct_option: e.target.value })}>
                {["A", "B", "C", "D"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="f_topic">Topic (optional)</label>
              <input id="f_topic" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : mode === "edit" ? "Save changes" : "Add question"}</button>
            {mode === "edit" && <button type="button" className="btn btn-outline" onClick={() => setMode("none")}>Cancel</button>}
          </div>
        </form>
      )}

      {mode === "bulk" && (
        <div className="portal-panel">
          <h2>Paste many questions</h2>
          <div className="t-form-grid">
            <div className="form-field">
              <label htmlFor="b_subject">Subject for all</label>
              <select id="b_subject" value={formSubject} onChange={(e) => setFormSubject(e.target.value)}>
                <option value="">Any subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="b_class">Class for all</label>
              <ClassSelect id="b_class" value={formClass} onChange={setFormClass} classes={classes} myClassIds={myClassIds} placeholder="Any class" />
            </div>
          </div>
          <p className="t-hint" style={{ marginTop: 0 }}>Write each question like this, with a blank line between questions:</p>
          <pre className="mcq-example">{`1. What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nAnswer: B`}</pre>
          <textarea className="t-textarea" rows={10} placeholder="Paste your questions here…" value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          {bulkText.trim() && (
            <div style={{ marginTop: 10 }}>
              <span className="pill pill-green">{parsed.questions.length} ready</span>{" "}
              {parsed.problems.length > 0 && <span className="pill pill-red">{parsed.problems.length} with problems</span>}
              {parsed.problems.map((p) => <p key={p} className="error-text" style={{ margin: "6px 0 0" }}>{p}</p>)}
            </div>
          )}
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={saveBulk} disabled={busy || parsed.questions.length === 0}>
            {busy ? "Saving…" : `Add ${parsed.questions.length} questions`}
          </button>
        </div>
      )}

      <div className="portal-panel" style={{ paddingBottom: 6 }}>
        <div className="t-form-grid">
          <div className="form-field">
            <label htmlFor="fl_subject">Subject</label>
            <select id="fl_subject" value={fSubject} onChange={(e) => setFSubject(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="fl_class">Class</label>
            <ClassSelect id="fl_class" value={fClass} onChange={setFClass} classes={classes} myClassIds={myClassIds} placeholder="All classes" />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="fl_search">Search</label>
          <input id="fl_search" placeholder="Words in the question" value={fSearch} onChange={(e) => setFSearch(e.target.value)} />
        </div>
      </div>

      {loadError && <div className="t-error" role="alert"><span>{loadError}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}

      {loading ? (
        <div className="skeleton" style={{ height: 200 }} />
      ) : questions.length === 0 ? (
        <div className="portal-panel"><div className="t-empty">No questions yet. Tap &ldquo;Add question&rdquo; or &ldquo;Paste many&rdquo;.</div></div>
      ) : (
        <div className="t-list">
          <p className="t-hint" style={{ margin: 0 }}>{questions.length} {questions.length === 1 ? "question" : "questions"}</p>
          {questions.map((q) => {
            const mine = role === "admin" || q.created_by === userId;
            return (
              <div className="portal-panel mcq-card" key={q.id} style={{ marginBottom: 0 }}>
                <div className="t-row-between" style={{ alignItems: "flex-start" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{q.question_text}</div>
                  {mine && (
                    <div className="t-icon-btns">
                      <button className="t-icon-btn" onClick={() => openEdit(q)} aria-label="Edit question"><Pencil size={16} /></button>
                      <button className="t-icon-btn danger" onClick={() => remove(q)} aria-label="Delete question"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                <div className="mcq-options">
                  {(["A", "B", "C", "D"] as const).map((o) => (
                    <div key={o} className={`mcq-opt ${q.correct_option === o ? "correct" : ""}`}>
                      <strong>{o}</strong> {q[`option_${o.toLowerCase()}`]}
                    </div>
                  ))}
                </div>
                <div className="t-test-meta" style={{ marginTop: 8 }}>
                  {[q.subject_id && subjectName(q.subject_id), q.class_id && `Class ${className(q.class_id)}`, q.topic].filter(Boolean).join(" · ") || "No subject or class set"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
