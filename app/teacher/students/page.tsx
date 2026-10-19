"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Users, TrendingUp, AlertTriangle } from "lucide-react";
import { useTeacher } from "@/components/TeacherShell";
import ClassSelect from "@/components/ClassSelect";
import { teacherApi } from "@/lib/teacherApi";

export default function StudentsPage() {
  const { classes, myClassIds } = useTeacher();
  const [classId, setClassId] = useState(myClassIds[0] || "");
  const [students, setStudents] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoading(true);
    setError("");
    const { ok, data } = await teacherApi(`/api/teacher/class-students?class_id=${classId}`);
    if (!ok) {
      setError(data.error || "Could not load students.");
      setStudents([]);
    } else {
      setStudents(data.students || []);
    }
    setLoading(false);
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const shown = q
    ? students.filter((s) => String(s.full_name).toLowerCase().includes(q) || String(s.roll_no).toLowerCase().includes(q))
    : students;

  const withData = students.filter((s) => s.pct !== null);
  const avg = withData.length ? Math.round(withData.reduce((a, s) => a + s.pct, 0) / withData.length) : null;
  const low = withData.filter((s) => s.pct < 75).length;

  return (
    <div className="portal-main">
      <h1 className="t-page-title">My Students</h1>

      <div className="portal-panel">
        <div className="t-form-row">
          <div className="form-field">
            <label htmlFor="class_id">Class</label>
            <ClassSelect id="class_id" value={classId} onChange={setClassId} classes={classes} myClassIds={myClassIds} />
          </div>
          <div className="form-field">
            <label htmlFor="search">Search</label>
            <div className="auth-input-wrap">
              <input id="search" placeholder="Name or roll number" value={search} onChange={(e) => setSearch(e.target.value)} />
              <span className="auth-toggle" style={{ pointerEvents: "none" }}><Search size={16} /></span>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="t-error" role="alert"><span>{error}</span><button className="btn btn-outline" onClick={load}>Try again</button></div>}

      {!classId ? (
        <div className="portal-panel"><div className="t-empty">Choose a class to see its students.</div></div>
      ) : loading ? (
        <div className="skeleton" style={{ height: 260 }} />
      ) : students.length === 0 ? (
        <div className="portal-panel"><div className="t-empty"><Users size={28} />No students in this class yet.</div></div>
      ) : (
        <>
          <div className="t-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div className="t-stat">
              <div className="icon-badge icon-badge-blue"><Users size={18} /></div>
              <div><div className="t-stat-num">{students.length}</div><div className="t-stat-label">Students</div></div>
            </div>
            <div className="t-stat">
              <div className="icon-badge icon-badge-green"><TrendingUp size={18} /></div>
              <div><div className="t-stat-num">{avg === null ? "—" : `${avg}%`}</div><div className="t-stat-label">Avg attendance (30 days)</div></div>
            </div>
            <div className="t-stat">
              <div className="icon-badge icon-badge-red"><AlertTriangle size={18} /></div>
              <div><div className="t-stat-num">{low}</div><div className="t-stat-label">Below 75%</div></div>
            </div>
          </div>

          <div className="portal-panel">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr><th>Roll</th><th>Name</th><th>GR No.</th><th>House</th><th>Attendance</th><th>Absent</th></tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id}>
                      <td>{s.roll_no}</td>
                      <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                      <td>{s.gr_number || "—"}</td>
                      <td>{s.house || "—"}</td>
                      <td>
                        {s.pct === null ? (
                          <span className="pill pill-gray">No data</span>
                        ) : (
                          <span className={`pill ${s.pct >= 90 ? "pill-green" : s.pct >= 75 ? "pill-amber" : "pill-red"}`}>{s.pct}%</span>
                        )}
                      </td>
                      <td>{s.absent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 && <div className="t-empty">No student matches &ldquo;{search}&rdquo;.</div>}
          </div>
        </>
      )}
    </div>
  );
}
