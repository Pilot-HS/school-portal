"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";
import { classLabel, formatDate, localISODate } from "@/lib/teacherUi";

export default function AssignmentsPage() {
  const { role, teacher, classes, myClassIds } = useTeacher();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [eClass, setEClass] = useState("");
  const [eSubject, setESubject] = useState("");
  const [eTitle, setETitle] = useState("");
  const [eDue, setEDue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    let query = supabase
      .from("assignments")
      .select("id, title, subject, due_date, class_id, created_by, classes(name, grade, section)")
      .order("due_date", { ascending: false })
      .limit(100);
    if (role === "teacher") {
      if (!teacher) {
        setItems([]);
        setLoading(false);
        return;
      }
      query = query.eq("created_by", teacher.id);
    }
    const { data, error } = await query;
    if (error) setLoadError("Could not load assignments. Please try again.");
    setItems(data || []);
    setLoading(false);
  }, [role, teacher]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(a: any) {
    setEditingId(a.id);
    setEClass(a.class_id || "");
    setESubject(a.subject || "");
    setETitle(a.title || "");
    setEDue(a.due_date || "");
    setMessage(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/update-assignment", {
      body: { id: editingId, class_id: eClass, subject: eSubject, title: eTitle, due_date: eDue || null },
    });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not save the changes." });
    } else {
      setEditingId(null);
      setMessage({ type: "success", text: "Assignment updated." });
      await load();
    }
    setBusy(false);
  }

  async function remove(a: any) {
    if (!window.confirm(`Delete "${a.title}"? This can't be undone.`)) return;
    setBusy(true);
    setMessage(null);
    const { ok, data } = await teacherApi("/api/teacher/delete-assignment", { body: { id: a.id } });
    if (!ok) {
      setMessage({ type: "error", text: data.error || "Could not delete this assignment." });
    } else {
      setMessage({ type: "success", text: "Assignment deleted." });
      await load();
    }
    setBusy(false);
  }

  const todayISO = localISODate();

  return (
    <div className="portal-main">
      <div className="t-row-between" style={{ marginBottom: 16 }}>
        <h1 className="t-page-title" style={{ margin: 0 }}>My Assignments</h1>
        <Link href="/teacher/assignments/new" className="btn btn-primary"><Plus size={15} /> New</Link>
      </div>

      {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status" style={{ marginTop: 0 }}>{message.text}</p>}
      {loadError && <div className="t-error" role="alert"><span>{loadError}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}

      {loading ? (
        <div className="skeleton" style={{ height: 220 }} />
      ) : items.length === 0 ? (
        <div className="portal-panel">
          <div className="t-empty"><BookOpen size={28} />You haven&apos;t posted any assignments yet.</div>
        </div>
      ) : (
        <div className="t-list">
          {items.map((a) => {
            const closed = !!a.due_date && a.due_date < todayISO;
            if (editingId === a.id) {
              return (
                <form key={a.id} className="portal-panel" onSubmit={saveEdit} style={{ marginBottom: 0 }}>
                  <div className="t-form-grid">
                    <div className="form-field">
                      <label htmlFor="e_class">Class</label>
                      <ClassSelect id="e_class" required value={eClass} onChange={setEClass} classes={classes} myClassIds={myClassIds} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="e_subject">Subject</label>
                      <input id="e_subject" required value={eSubject} onChange={(e) => setESubject(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="e_title">Title</label>
                      <input id="e_title" required value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label htmlFor="e_due">Due date</label>
                      <input id="e_due" type="date" value={eDue} onChange={(e) => setEDue(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              );
            }
            return (
              <div key={a.id} className="t-test-card" style={{ cursor: "default" }}>
                <div className="icon-badge icon-badge-amber" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                  <BookOpen size={20} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="t-test-name">{a.title}</div>
                  <div className="t-test-meta">
                    {a.subject} · Class {classLabel(a.classes)} · {a.due_date ? `Due ${formatDate(a.due_date)}` : "No due date"}{" "}
                    <span className={`pill ${closed ? "pill-gray" : "pill-green"}`}>{closed ? "Closed" : "Open"}</span>
                  </div>
                </div>
                <div className="t-icon-btns">
                  <button className="t-icon-btn" onClick={() => startEdit(a)} aria-label={`Edit ${a.title}`}><Pencil size={16} /></button>
                  <button className="t-icon-btn danger" onClick={() => remove(a)} disabled={busy} aria-label={`Delete ${a.title}`}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
