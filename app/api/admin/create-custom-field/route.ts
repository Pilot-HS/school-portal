import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { form_type, section, label, field_type, options, is_required } = body;

  if (!form_type || !section || !label || !field_type) {
    return NextResponse.json({ error: "Form type, section, label, and field type are required" }, { status: 400 });
  }

  const { data: maxOrder } = await supabaseAdmin
    .from("custom_field_definitions")
    .select("display_order")
    .eq("form_type", form_type)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("custom_field_definitions")
    .insert({
      form_type,
      section,
      label,
      field_type,
      options: field_type === "dropdown" ? options : null,
      is_required: !!is_required,
      display_order: (maxOrder?.display_order || 0) + 1,
      created_by: auth.userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, field: data });
}
