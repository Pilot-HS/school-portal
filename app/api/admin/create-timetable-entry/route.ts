import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { class_id, day_of_week, period_number, subject, teacher_id } = body;

  if (!class_id || !day_of_week || !period_number || !subject) {
    return NextResponse.json({ error: "Class, day, period, and subject are required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("timetable_entries")
    .select("id, subject")
    .eq("class_id", class_id)
    .eq("day_of_week", day_of_week)
    .eq("period_number", period_number)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Period ${period_number} on ${day_of_week} is already assigned to ${existing.subject} for this class.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("timetable_entries")
    .insert({ class_id, day_of_week, period_number, subject, teacher_id: teacher_id || null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, entry: data });
}
