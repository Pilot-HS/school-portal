import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { admission_id, status } = body;

  if (!admission_id || !status) {
    return NextResponse.json({ error: "admission_id and status are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("admissions").update({ status }).eq("id", admission_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
