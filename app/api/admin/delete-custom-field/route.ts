import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { field_id } = body;

  if (!field_id) {
    return NextResponse.json({ error: "field_id is required" }, { status: 400 });
  }

  const { count } = await supabaseAdmin
    .from("custom_field_values")
    .select("*", { count: "exact", head: true })
    .eq("field_definition_id", field_id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "This field already has saved data, so it can't be deleted. Hide it instead to keep the data safe." },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("custom_field_definitions").delete().eq("id", field_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
