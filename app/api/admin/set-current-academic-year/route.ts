import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { academic_year_id } = body;

  if (!academic_year_id) {
    return NextResponse.json({ error: "academic_year_id is required" }, { status: 400 });
  }

  await supabaseAdmin.from("academic_years").update({ is_current: false }).eq("is_current", true);
  const { error } = await supabaseAdmin.from("academic_years").update({ is_current: true }).eq("id", academic_year_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
