import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { application_id, status, section, gr_number } = body;

  if (!application_id) {
    return NextResponse.json({ error: "application_id is required" }, { status: 400 });
  }

  if (gr_number) {
    const { data: existing } = await supabaseAdmin
      .from("admission_applications")
      .select("id, student_full_name")
      .eq("gr_number", gr_number)
      .neq("id", application_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: `GR number ${gr_number} is already assigned to ${existing.student_full_name}.` },
        { status: 400 }
      );
    }
  }

  const updates: Record<string, any> = {};
  if (status !== undefined) updates.status = status;
  if (section !== undefined) updates.section = section || null;
  if (gr_number !== undefined) updates.gr_number = gr_number || null;

  const { error } = await supabaseAdmin.from("admission_applications").update(updates).eq("id", application_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
