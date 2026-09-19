import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { label, set_as_current } = body;

  if (!label) {
    return NextResponse.json({ error: "Label is required, e.g. 2026-2027" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin.from("academic_years").select("id").eq("label", label).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `Academic year ${label} already exists.` }, { status: 400 });
  }

  if (set_as_current) {
    await supabaseAdmin.from("academic_years").update({ is_current: false }).eq("is_current", true);
  }

  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .insert({ label, is_current: !!set_as_current })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, academic_year: data });
}
