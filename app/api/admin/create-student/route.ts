import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { full_name, roll_no, class_id, profile_id, parent_profile_id } = body;

  if (!full_name || !roll_no || !class_id) {
    return NextResponse.json({ error: "Name, roll number, and class are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .insert({
      full_name,
      roll_no,
      class_id,
      profile_id: profile_id || null,
      parent_profile_id: parent_profile_id || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, student: data });
}
