import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";

// A teacher creates a class test: one exam + one subject-for-a-class entry.
// It then shows up in the admin's Exams & Results area too.
export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const name = String(body.name || "").trim();
  const { class_id, subject_id, date, term } = body;
  const maxMarks = Number(body.max_marks);

  if (!name || !class_id || !subject_id) {
    return NextResponse.json({ error: "Test name, class and subject are required" }, { status: 400 });
  }
  if (!Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 1000) {
    return NextResponse.json({ error: "Total marks must be a number greater than 0" }, { status: 400 });
  }

  if (!(await canAccessClass(auth, class_id))) return noAccessResponse();

  const { data: currentYear } = await supabaseAdmin
    .from("academic_years")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();

  const { data: exam, error: examError } = await supabaseAdmin
    .from("exams")
    .insert({
      name,
      term: term ? String(term).trim() : null,
      academic_year_id: currentYear?.id || null,
      start_date: date || null,
      end_date: date || null,
    })
    .select()
    .single();

  if (examError || !exam) {
    return NextResponse.json({ error: examError?.message || "Could not create the test" }, { status: 400 });
  }

  const { data: examSubject, error: esError } = await supabaseAdmin
    .from("exam_subjects")
    .insert({ exam_id: exam.id, class_id, subject_id, max_marks: maxMarks })
    .select()
    .single();

  if (esError || !examSubject) {
    // Undo the exam so nothing half-finished is left behind
    await supabaseAdmin.from("exams").delete().eq("id", exam.id);
    return NextResponse.json({ error: esError?.message || "Could not create the test" }, { status: 400 });
  }

  return NextResponse.json({ success: true, id: examSubject.id });
}
