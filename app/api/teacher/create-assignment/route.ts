import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { class_id, subject, title, due_date } = body;

  if (!class_id || !subject || !title) {
    return NextResponse.json({ error: "Class, subject, and title are required" }, { status: 400 });
  }

  let createdBy: string | null = null;
  if (auth.role === "teacher") {
    const { data: teacherRow } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .eq("profile_id", auth.userId)
      .single();
    createdBy = teacherRow?.id || null;
  }

  const { data, error } = await supabaseAdmin
    .from("assignments")
    .insert({ class_id, subject, title, due_date: due_date || null, created_by: createdBy })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, assignment: data });
}
