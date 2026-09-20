import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { field_id, label, section, options, is_required, is_active } = body;

  if (!field_id) {
    return NextResponse.json({ error: "field_id is required" }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (label !== undefined) updates.label = label;
  if (section !== undefined) updates.section = section;
  if (options !== undefined) updates.options = options;
  if (is_required !== undefined) updates.is_required = is_required;
  if (is_active !== undefined) updates.is_active = is_active;

  const { error } = await supabaseAdmin.from("custom_field_definitions").update(updates).eq("id", field_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
