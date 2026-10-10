import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const { exam_id, class_id, subject_id, max_marks } = body;
  if (!exam_id || !class_id || !subject_id || !max_marks) {
    return NextResponse.json({ error: "Exam, class, subject, and max marks are all required" }, { status: 400 });
  }
  const { data: existing } = await supabaseAdmin
    .from("exam_subjects")
    .select("id")
    .eq("exam_id", exam_id)
    .eq("class_id", class_id)
    .eq("subject_id", subject_id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "This subject is already assigned to this class for this exam." }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("exam_subjects")
    .insert({ exam_id, class_id, subject_id, max_marks: Number(max_marks) })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, exam_subject: data });
}
