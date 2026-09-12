import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { subject, exam_name, total_marks, term, records } = body;
  // records: [{ student_id, marks_obtained }]

  if (!subject || !exam_name || !total_marks || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Subject, exam name, total marks, and at least one student are required" }, { status: 400 });
  }

  const studentIds = records.map((r: any) => r.student_id);

  // Replace any existing result for this exact exam + subject for these students,
  // so re-submitting corrects marks instead of duplicating rows.
  await supabaseAdmin
    .from("exam_results")
    .delete()
    .eq("subject", subject)
    .eq("exam_name", exam_name)
    .in("student_id", studentIds);

  const rowsToInsert = records.map((r: any) => ({
    student_id: r.student_id,
    subject,
    exam_name,
    marks_obtained: r.marks_obtained,
    total_marks,
    term: term || null,
  }));

  const { error } = await supabaseAdmin.from("exam_results").insert(rowsToInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, count: rowsToInsert.length });
}
