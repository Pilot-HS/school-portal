import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { exam_id, class_id, subject_id, records } = body;

  if (!exam_id || !class_id || !subject_id || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Exam, class, subject, and at least one student are required" }, { status: 400 });
  }

  const [{ data: exam }, { data: subject }, { data: examSubject }] = await Promise.all([
    supabaseAdmin.from("exams").select("*").eq("id", exam_id).single(),
    supabaseAdmin.from("subjects").select("*").eq("id", subject_id).single(),
    supabaseAdmin.from("exam_subjects").select("*").eq("exam_id", exam_id).eq("class_id", class_id).eq("subject_id", subject_id).single(),
  ]);

  if (!exam || !subject || !examSubject) {
    return NextResponse.json({ error: "This subject isn't scheduled for this exam and class. Check Exam Scheduling first." }, { status: 400 });
  }

  const totalMarks = examSubject.max_marks;

  const invalidRecord = records.find(
    (r: any) => r.marks_obtained === null || r.marks_obtained === undefined || Number(r.marks_obtained) < 0 || Number(r.marks_obtained) > Number(totalMarks)
  );
  if (invalidRecord) {
    return NextResponse.json({ error: `One or more marks are invalid — each score must be between 0 and ${totalMarks}.` }, { status: 400 });
  }

  const studentIds = records.map((r: any) => r.student_id);

  await supabaseAdmin.from("exam_results").delete().eq("exam_id", exam_id).eq("subject_id", subject_id).in("student_id", studentIds);

  const rowsToInsert = records.map((r: any) => ({
    student_id: r.student_id,
    subject: subject.name,
    exam_name: exam.name,
    marks_obtained: r.marks_obtained,
    total_marks: totalMarks,
    term: exam.term || null,
    exam_id,
    subject_id,
  }));

  const { error } = await supabaseAdmin.from("exam_results").insert(rowsToInsert);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, count: rowsToInsert.length });
}
