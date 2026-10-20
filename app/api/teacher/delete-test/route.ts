import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";

// Deletes a test that has no marks yet (e.g. created by mistake).
export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Test id is required" }, { status: 400 });
  }

  const { data: test } = await supabaseAdmin.from("exam_subjects").select("id, exam_id, subject_id, class_id").eq("id", id).maybeSingle();
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }

  if (!(await canAccessClass(auth, test.class_id))) return noAccessResponse();

  const { count } = await supabaseAdmin
    .from("exam_results")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", test.exam_id)
    .eq("subject_id", test.subject_id);

  if ((count || 0) > 0) {
    return NextResponse.json(
      { error: "This test already has marks saved, so it can't be deleted here. Ask the admin if it really must be removed." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("exam_subjects").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit(auth.userId, "tests", "Deleted a test that had no marks", { exam_subject_id: id });

  // Remove the exam itself only if nothing else is attached to it
  const { count: remaining } = await supabaseAdmin
    .from("exam_subjects")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", test.exam_id);
  if ((remaining || 0) === 0) {
    await supabaseAdmin.from("exams").delete().eq("id", test.exam_id);
  }

  return NextResponse.json({ success: true });
}
