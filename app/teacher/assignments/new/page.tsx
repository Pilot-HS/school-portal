"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";

export default function NewAssignmentPage() {
  const { classes, myClassIds, teacher } = useTeacher();
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [subject, setSubject] = useState(teacher?.subject || "");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const { ok, data } = await teacherApi("/api/teacher/create-assignment", {
      body: { class_id: classId, subject, title, due_date: dueDate || null },
    });

    if (!ok) {
      setMessage({ type: "error", text: data.error || "Something went wrong." });
    } else {
      setMessage({ type: "success", text: "Assignment posted." });
      setTitle("");
      setDueDate("");
    }
    setSubmitting(false);
  }

  return (
    <div className="portal-main">
      <Link href="/teacher/assignments" className="t-back"><ArrowLeft size={15} /> My assignments</Link>
      <h1 className="t-page-title" style={{ marginTop: 8 }}>Post an Assignment</h1>

      <div className="portal-panel" style={{ maxWidth: 520 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="class_id">Class</label>
            <ClassSelect id="class_id" required value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
          </div>
          <div className="form-field">
            <label htmlFor="subject">Subject</label>
            <input id="subject" required placeholder="e.g. Mathematics" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="title">Assignment title</label>
            <input id="title" required placeholder="e.g. Chapter 4 exercise set" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="due_date">Due date (optional)</label>
            <input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Posting…" : "Post Assignment"}
          </button>
          {message && <p className={message.type === "success" ? "success-text" : "error-text"} role="status">{message.text}</p>}
        </form>
      </div>
    </div>
  );
}
