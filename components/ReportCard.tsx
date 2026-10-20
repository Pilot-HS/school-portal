// One printable report card. It only displays what it is given.

export type RcStudent = {
  id: string;
  full_name: string;
  roll_no: string;
  gr_number?: string | null;
  house?: string | null;
  class_name: string;
  results: { exam_id?: string; exam_name: string; term?: string | null; subject: string; marks_obtained: number; total_marks: number }[];
  attendance: { present: number; absent: number; leave: number };
};
export type RcBand = { grade_label: string; min_percentage: number; max_percentage: number; remarks?: string | null };

export const examKey = (r: { exam_name: string; term?: string | null }) => `${r.exam_name || "Exam"}${r.term ? ` · ${r.term}` : ""}`;

export function examKeysOf(student: RcStudent): string[] {
  return Array.from(new Set(student.results.map(examKey))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function gradeFor(pct: number, bands: RcBand[]): string {
  if (!bands.length) return "";
  const exact = bands.find((b) => pct >= Number(b.min_percentage) && pct <= Number(b.max_percentage));
  if (exact) return exact.grade_label;
  const below = bands.filter((b) => Number(b.min_percentage) <= pct).sort((a, b) => Number(b.min_percentage) - Number(a.min_percentage))[0];
  return below ? below.grade_label : bands[bands.length - 1].grade_label;
}

export function autoRemark(overallPct: number | null, attendancePct: number | null): string {
  if (overallPct === null) return "";
  let r =
    overallPct >= 90 ? "Outstanding performance. Keep up the excellent work!"
    : overallPct >= 80 ? "Very good performance. Keep it up."
    : overallPct >= 70 ? "Good work. A little more effort will bring even better results."
    : overallPct >= 60 ? "Satisfactory. Needs to work harder and revise regularly."
    : overallPct >= 40 ? "Below average. Needs regular practice and more attention to studies."
    : "Poor performance. Needs urgent improvement and parental support.";
  if (attendancePct !== null && attendancePct < 75) r += " Attendance needs to improve.";
  return r;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export default function ReportCard({
  student,
  bands,
  yearLabel,
  remark,
  includeExams,
  school = "Government Boys High School, P.H. Pilot, Dadu",
}: {
  student: RcStudent;
  bands: RcBand[];
  yearLabel?: string;
  remark?: string;
  includeExams?: string[];
  school?: string;
}) {
  const allKeys = examKeysOf(student);
  const exams = includeExams ? allKeys.filter((k) => includeExams.includes(k)) : allKeys;
  const rows = student.results.filter((r) => exams.includes(examKey(r)));
  const subjects = Array.from(new Set(rows.map((r) => r.subject))).sort((a, b) => a.localeCompare(b));

  const cell = (subject: string, ek: string) => rows.find((r) => r.subject === subject && examKey(r) === ek);
  const examTotals = exams.map((ek) => {
    const rs = rows.filter((r) => examKey(r) === ek);
    const got = rs.reduce((a, r) => a + Number(r.marks_obtained || 0), 0);
    const max = rs.reduce((a, r) => a + Number(r.total_marks || 0), 0);
    return { got, max, pct: max > 0 ? (got / max) * 100 : null };
  });
  const subjectTotals = subjects.map((s) => {
    const rs = rows.filter((r) => r.subject === s);
    const got = rs.reduce((a, r) => a + Number(r.marks_obtained || 0), 0);
    const max = rs.reduce((a, r) => a + Number(r.total_marks || 0), 0);
    return { got, max, pct: max > 0 ? (got / max) * 100 : null };
  });
  const grandGot = rows.reduce((a, r) => a + Number(r.marks_obtained || 0), 0);
  const grandMax = rows.reduce((a, r) => a + Number(r.total_marks || 0), 0);
  const overall = grandMax > 0 ? (grandGot / grandMax) * 100 : null;

  const att = student.attendance;
  const attTotal = att.present + att.absent + att.leave;
  const attPct = attTotal > 0 ? Math.round((att.present / attTotal) * 100) : null;
  const finalRemark = (remark && remark.trim()) || autoRemark(overall, attPct);

  return (
    <div className={`report-card ${exams.length > 5 ? "rc-dense" : ""}`}>
      <div className="rc-head">
        <div className="rc-school">{school}</div>
        <div className="rc-title">STUDENT REPORT CARD</div>
        {yearLabel && <div className="rc-year">Academic Year {yearLabel}</div>}
      </div>

      <div className="rc-info">
        <div><span>Name</span><strong>{student.full_name}</strong></div>
        <div><span>Class</span><strong>{student.class_name || "—"}</strong></div>
        <div><span>Roll No.</span><strong>{student.roll_no}</strong></div>
        <div><span>GR No.</span><strong>{student.gr_number || "—"}</strong></div>
        {student.house && <div><span>House</span><strong>{student.house}</strong></div>}
      </div>

      {exams.length === 0 ? (
        <p className="rc-empty">No exam results have been recorded yet.</p>
      ) : (
        <table className="rc-table">
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Subject</th>
              {exams.map((ek) => <th key={ek}>{ek}</th>)}
              <th>Total</th>
              <th>%</th>
              {bands.length > 0 && <th>Grade</th>}
            </tr>
          </thead>
          <tbody>
            {subjects.map((s, i) => {
              const st = subjectTotals[i];
              return (
                <tr key={s}>
                  <td style={{ textAlign: "left" }}>{s}</td>
                  {exams.map((ek) => {
                    const c = cell(s, ek);
                    return <td key={ek}>{c ? `${fmt(Number(c.marks_obtained))}/${fmt(Number(c.total_marks))}` : "—"}</td>;
                  })}
                  <td>{fmt(st.got)}/{fmt(st.max)}</td>
                  <td>{st.pct === null ? "—" : `${Math.round(st.pct)}%`}</td>
                  {bands.length > 0 && <td><strong>{st.pct === null ? "—" : gradeFor(st.pct, bands)}</strong></td>}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ textAlign: "left" }}><strong>Total</strong></td>
              {examTotals.map((t, i) => (
                <td key={i}><strong>{fmt(t.got)}/{fmt(t.max)}</strong><div>{t.pct === null ? "" : `${Math.round(t.pct)}%`}</div></td>
              ))}
              <td><strong>{fmt(grandGot)}/{fmt(grandMax)}</strong></td>
              <td><strong>{overall === null ? "—" : `${Math.round(overall)}%`}</strong></td>
              {bands.length > 0 && <td><strong>{overall === null ? "—" : gradeFor(overall, bands)}</strong></td>}
            </tr>
          </tfoot>
        </table>
      )}

      <div className="rc-att">
        <strong>Attendance:</strong> {attTotal === 0 ? "No attendance recorded." : `${att.present} present, ${att.absent} absent, ${att.leave} on leave out of ${attTotal} days (${attPct}%)`}
      </div>

      <div className="rc-remark">
        <strong>Remarks:</strong> {finalRemark || "—"}
      </div>

      <div className="rc-sign">
        <div><span />Class Teacher</div>
        <div><span />Head Master</div>
        <div><span />Parent / Guardian</div>
      </div>
    </div>
  );
}
