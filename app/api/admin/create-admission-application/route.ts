import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, buildApplicationRecord, formatApplicationId } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const record = await buildApplicationRecord(formData);

  if (!record.student_full_name || !record.parent_contact) {
    return NextResponse.json({ error: "Student name and parent contact number are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("admission_applications").insert(record).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const referenceId = formatApplicationId(data.application_seq, data.created_at);

  return NextResponse.json({ success: true, application: data, reference_id: referenceId });
}
