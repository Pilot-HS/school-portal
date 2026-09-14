import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { student_id, full_name, roll_no, class_id, profile_id, parent_profile_id } = body;

  if (!student_id || !full_name || !roll_no || !class_id) {
    return NextResponse.json({ error: "Student ID, name, roll number, and class are required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("students")
    .select("id, full_name")
    .eq("class_id", class_id)
    .eq("roll_no", roll_no)
    .neq("id", student_id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Roll number ${roll_no} is already used by ${existing.full_name} in this class. Choose a different roll number.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .update({
      full_name,
      roll_no,
      class_id,
      profile_id: profile_id || null,
      parent_profile_id: parent_profile_id || null,
    })
    .eq("id", student_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, student: data });
}
