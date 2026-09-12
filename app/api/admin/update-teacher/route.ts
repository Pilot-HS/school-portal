import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { teacher_id, full_name, subject, profile_id } = body;

  if (!teacher_id || !full_name) {
    return NextResponse.json({ error: "Teacher ID and name are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .update({
      full_name,
      subject: subject || null,
      profile_id: profile_id || null,
    })
    .eq("id", teacher_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, teacher: data });
}
