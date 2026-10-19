import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

// Returns the subject list (for the "new test" form) and the latest tests/exams.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const classId = new URL(request.url).searchParams.get("class_id");

  let testQuery = supabaseAdmin
    .from("exam_subjects")
    .select("id, exam_id, class_id, subject_id, max_marks, exams(name, term, start_date, created_at), classes(name, grade, section), subjects(name)")
    .limit(300);
  if (classId) testQuery = testQuery.eq("class_id", classId);

  const [subjectsRes, testsRes] = await Promise.all([
    supabaseAdmin.from("subjects").select("id, name").order("name"),
    testQuery,
  ]);

  if (testsRes.error) {
    return NextResponse.json({ error: testsRes.error.message }, { status: 400 });
  }

  const tests = (testsRes.data || [])
    .sort((a: any, b: any) => {
      const da = a.exams?.created_at || "";
      const db = b.exams?.created_at || "";
      return da < db ? 1 : da > db ? -1 : 0;
    })
    .slice(0, 60);

  return NextResponse.json({ subjects: subjectsRes.data || [], tests });
}
