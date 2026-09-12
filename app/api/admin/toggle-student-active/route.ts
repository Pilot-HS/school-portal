import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { student_id, is_active } = body;

  if (!student_id || typeof is_active !== "boolean") {
    return NextResponse.json({ error: "student_id and is_active are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("students").update({ is_active }).eq("id", student_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
