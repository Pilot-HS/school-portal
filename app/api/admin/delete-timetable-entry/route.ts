import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { entry_id } = body;

  if (!entry_id) {
    return NextResponse.json({ error: "entry_id is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("timetable_entries").delete().eq("id", entry_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
