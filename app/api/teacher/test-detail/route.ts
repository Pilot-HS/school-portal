import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";

// One test: details, every student in the class and any marks already saved.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Test id is required" }, { status: 400 });
  }

  const { data: test, error } = await supabaseAdmin
    .from("exam_subjects")
    .select("id, exam_id, class_id, subject_id, max_marks, exams(name, term, start_date), classes(name, grade, section), subjects(name)")
    .eq("id", id)
    .maybeSingle();

  if (error || !test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  if (!(await canAccessClass(auth, test.class_id))) return noAccessResponse();

  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id, full_name, roll_no, is_active")
    .eq("class_id", test.class_id)
    .order("roll_no");

  const activeStudents = (students || []).filter((s: any) => s.is_active !== false);
  const ids = activeStudents.map((s: any) => s.id);

  let results: any[] = [];
  if (ids.length > 0) {
    const { data } = await supabaseAdmin
      .from("exam_results")
      .select("student_id, marks_obtained")
      .eq("exam_id", test.exam_id)
      .eq("subject_id", test.subject_id)
      .in("student_id", ids);
    results = data || [];
  }
  const marksByStudent: Record<string, number> = {};
  results.forEach((r) => {
    marksByStudent[r.student_id] = r.marks_obtained;
  });

  return NextResponse.json({
    test,
    students: activeStudents.map((s: any) => ({
      id: s.id,
      full_name: s.full_name,
      roll_no: s.roll_no,
      marks_obtained: marksByStudent[s.id] ?? null,
    })),
  });
}
