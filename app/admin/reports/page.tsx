"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";

const SCHOOL_NAME = "Government Boys High School, P.H. Pilot, Dadu";

type ReportType = "report_card" | "attendance_summary" | "fee_summary";

export default function ReportsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [reportType, setReportType] = useState<ReportType>("report_card");

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const { data: classData } = await supabase.from("classes").select("*").order("grade");
      setClasses(classData || []);
      setLoading(false);
    })();
  }, [router]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <AdminLayout active="reports" fullName={fullName}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "20px" }} className="no-print">Reports</h1>

      <div className="portal-panel no-print" style={{ maxWidth: "360px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="report_type">Report type</label>
          <select id="report_type" value={reportType} onChange={(e) => setReportType(e.target.value as ReportType)}>
            <option value="report_card">Student Report Card</option>
            <option value="attendance_summary">Class Attendance Summary</option>
            <option value="fee_summary">Fee Collection Summary</option>
          </select>
        </div>
      </div>

      {reportType === "report_card" && <ReportCard />}
      {reportType === "attendance_summary" && <AttendanceSummary classes={classes} />}
      {reportType === "fee_summary" && <FeeSummary classes={classes} />}
    </AdminLayout>
  );
}

function ReportHeader({ title }: { title: string }) {
  return (
    <div style={{ marginBottom: "20px", borderBottom: "2px solid var(--ink)", paddingBottom: "12px" }}>
      <h2 style={{ margin: 0 }}>{SCHOOL_NAME}</h2>
      <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{title}</p>
    </div>
  );
}

function PrintButton() {
  return (
    <button className="btn btn-primary no-print" style={{ marginBottom: "16px" }} onClick={() => window.print()}>
      Print / Save as PDF
    </button>
  );
}

function ReportCard() {
  const [students, setStudents] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [student, setStudent] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, total: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("students").select("*, classes(name)").order("full_name");
      setStudents(data || []);
    })();
  }, []);

  useEffect(() => {
    if (!studentId) {
      setStudent(null);
      setResults([]);
      return;
    }
    (async () => {
      const found = students.find((s) => s.id === studentId);
      setStudent(found || null);

      const [{ data: resultData }, { data: attendanceData }] = await Promise.all([
        supabase.from("exam_results").select("*").eq("student_id", studentId),
        supabase.from("attendance").select("status").eq("student_id", studentId),
      ]);
      setResults(resultData || []);
      const present = (attendanceData || []).filter((a) => a.status === "present").length;
      setAttendanceStats({ present, total: (attendanceData || []).length });
    })();
  }, [studentId, students]);

  const totalObtained = results.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
  const totalPossible = results.reduce((sum, r) => sum + Number(r.total_marks || 0), 0);
  const percentage = totalPossible > 0 ? Math.round((totalObtained / totalPossible) * 100) : 0;

  return (
    <div>
      <div className="portal-panel no-print" style={{ maxWidth: "420px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="student_id">Choose a student</label>
          <select id="student_id" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select a student&hellip;</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.classes?.name || "no class"})</option>
            ))}
          </select>
        </div>
      </div>

      {student && (
        <div className="portal-panel">
          <PrintButton />
          <ReportHeader title="Student Report Card" />
          <table className="data-table" style={{ marginBottom: "20px" }}>
            <tbody>
              <tr><th>Student Name</th><td>{student.full_name}</td><th>Class</th><td>{student.classes?.name || "\u2014"}</td></tr>
              <tr><th>Roll No.</th><td>{student.roll_no}</td><th>Attendance</th><td>{attendanceStats.present}/{attendanceStats.total} days present</td></tr>
            </tbody>
          </table>

          <h2>Exam Results</h2>
          {results.length === 0 ? (
            <p>No exam results recorded for this student yet.</p>
          ) : (
            <>
              <table className="data-table">
                <thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Percentage</th></tr></thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td>{r.subject}</td>
                      <td>{r.exam_name}</td>
                      <td>{r.marks_obtained} / {r.total_marks}</td>
                      <td>{Math.round((Number(r.marks_obtained) / Number(r.total_marks)) * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: "16px", fontWeight: 600 }}>
                Overall: {totalObtained} / {totalPossible} ({percentage}%)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AttendanceSummary({ classes }: { classes: any[] }) {
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [className, setClassName] = useState("");

  useEffect(() => {
    if (!classId) {
      setRows([]);
      return;
    }
    (async () => {
      const selectedClass = classes.find((c) => c.id === classId);
      setClassName(selectedClass ? `${selectedClass.grade}-${selectedClass.section}` : "");

      const { data: studentsInClass } = await supabase.from("students").select("id, full_name, roll_no").eq("class_id", classId).order("roll_no");
      const studentIds = (studentsInClass || []).map((s) => s.id);

      const { data: attendanceData } = await supabase.from("attendance").select("student_id, status").in("student_id", studentIds);

      const summary = (studentsInClass || []).map((s) => {
        const records = (attendanceData || []).filter((a) => a.student_id === s.id);
        const present = records.filter((a) => a.status === "present").length;
        const absent = records.filter((a) => a.status === "absent").length;
        const leave = records.filter((a) => a.status === "leave").length;
        const total = records.length;
        return { ...s, present, absent, leave, total, pct: total > 0 ? Math.round((present / total) * 100) : 0 };
      });
      setRows(summary);
    })();
  }, [classId, classes]);

  return (
    <div>
      <div className="portal-panel no-print" style={{ maxWidth: "320px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="attendance_class">Choose a class</label>
          <select id="attendance_class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class&hellip;</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
            ))}
          </select>
        </div>
      </div>

      {classId && (
        <div className="portal-panel">
          <PrintButton />
          <ReportHeader title={`Attendance Summary — Class ${className}`} />
          {rows.length === 0 ? (
            <p>No students in this class yet.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Roll No.</th><th>Name</th><th>Present</th><th>Absent</th><th>Leave</th><th>Attendance %</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.roll_no}</td>
                    <td>{r.full_name}</td>
                    <td>{r.present}</td>
                    <td>{r.absent}</td>
                    <td>{r.leave}</td>
                    <td>{r.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function FeeSummary({ classes }: { classes: any[] }) {
  const [classId, setClassId] = useState("all");
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState({ paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 });

  useEffect(() => {
    (async () => {
      let studentQuery = supabase.from("students").select("id, full_name, class_id, classes(name)");
      if (classId !== "all") studentQuery = studentQuery.eq("class_id", classId);
      const { data: studentsInScope } = await studentQuery;
      const studentIds = (studentsInScope || []).map((s) => s.id);

      const { data: feeData } = await supabase.from("fees").select("*").in("student_id", studentIds);

      const byStudent = (studentsInScope || []).map((s) => {
        const fees = (feeData || []).filter((f) => f.student_id === s.id);
        const paid = fees.filter((f) => f.status === "paid").reduce((sum, f) => sum + Number(f.amount), 0);
        const unpaid = fees.filter((f) => f.status === "unpaid").reduce((sum, f) => sum + Number(f.amount), 0);
        return { ...s, paid, unpaid };
      });
      setRows(byStudent);

      const paid = (feeData || []).filter((f) => f.status === "paid").reduce((sum, f) => sum + Number(f.amount), 0);
      const unpaid = (feeData || []).filter((f) => f.status === "unpaid").reduce((sum, f) => sum + Number(f.amount), 0);
      const paidCount = (feeData || []).filter((f) => f.status === "paid").length;
      const unpaidCount = (feeData || []).filter((f) => f.status === "unpaid").length;
      setTotals({ paid, unpaid, paidCount, unpaidCount });
    })();
  }, [classId]);

  return (
    <div>
      <div className="portal-panel no-print" style={{ maxWidth: "320px" }}>
        <div className="form-field" style={{ marginBottom: 0 }}>
          <label htmlFor="fee_class">Class</label>
          <select id="fee_class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="all">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.grade}-{c.section}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="portal-panel">
        <PrintButton />
        <ReportHeader title="Fee Collection Summary" />
        <div className="portal-cards" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "420px" }}>
          <div className="icon-stat-card">
            <div className="icon-stat-num">PKR {totals.paid}</div>
            <div className="icon-stat-label">Collected ({totals.paidCount} charges)</div>
          </div>
          <div className="icon-stat-card">
            <div className="icon-stat-num">PKR {totals.unpaid}</div>
            <div className="icon-stat-label">Outstanding ({totals.unpaidCount} charges)</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <p>No students in scope.</p>
        ) : (
          <table className="data-table">
            <thead><tr><th>Student</th><th>Class</th><th>Paid</th><th>Outstanding</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.full_name}</td>
                  <td>{r.classes?.name || "\u2014"}</td>
                  <td>PKR {r.paid}</td>
                  <td>PKR {r.unpaid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
