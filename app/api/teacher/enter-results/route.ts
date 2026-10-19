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
    (r: any) =>
      r.marks_obtained === null ||
      r.marks_obtained === undefined ||
      !Number.isFinite(Number(r.marks_obtained)) ||
      Number(r.marks_obtained) < 0 ||
      Number(r.marks_obtained) > Number(totalMarks)
  );
  if (invalidRecord) {
    return NextResponse.json({ error: `One or more marks are invalid — each score must be between 0 and ${totalMarks}.` }, { status: 400 });
  }

  // Only accept students who really belong to this class
  const { data: classStudents } = await supabaseAdmin.from("students").select("id").eq("class_id", class_id);
  const allowed = new Set((classStudents || []).map((s: any) => s.id));
  const cleanRecords = records.filter((r: any) => allowed.has(r.student_id));
  if (cleanRecords.length === 0) {
    return NextResponse.json({ error: "None of these students belong to the selected class." }, { status: 400 });
  }

  const studentIds = cleanRecords.map((r: any) => r.student_id);

  // Update marks that already exist, insert the new ones. Nothing is deleted,
  // so a failed save can never wipe out marks that were saved before.
  const { data: existing } = await supabaseAdmin
    .from("exam_results")
    .select("id, student_id")
    .eq("exam_id", exam_id)
    .eq("subject_id", subject_id)
    .in("student_id", studentIds);
  const existingByStudent: Record<string, string> = {};
  (existing || []).forEach((e: any) => {
    existingByStudent[e.student_id] = e.id;
  });

  const toUpdate = cleanRecords.filter((r: any) => existingByStudent[r.student_id]);
  const toInsert = cleanRecords
    .filter((r: any) => !existingByStudent[r.student_id])
    .map((r: any) => ({
      student_id: r.student_id,
      subject: subject.name,
      exam_name: exam.name,
      marks_obtained: Number(r.marks_obtained),
      total_marks: totalMarks,
      term: exam.term || null,
      exam_id,
      subject_id,
    }));

  const updateResults = await Promise.all(
    toUpdate.map((r: any) =>
      supabaseAdmin
        .from("exam_results")
        .update({ marks_obtained: Number(r.marks_obtained), total_marks: totalMarks })
        .eq("id", existingByStudent[r.student_id])
    )
  );
  const updateError = updateResults.find((u) => u.error);
  if (updateError?.error) {
    return NextResponse.json({ error: updateError.error.message }, { status: 400 });
  }

  if (toInsert.length > 0) {
    const { error } = await supabaseAdmin.from("exam_results").insert(toInsert);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, count: cleanRecords.length });
}
