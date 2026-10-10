import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const { exam_subject_id } = body;
  if (!exam_subject_id) {
    return NextResponse.json({ error: "exam_subject_id is required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("exam_subjects").delete().eq("id", exam_subject_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
