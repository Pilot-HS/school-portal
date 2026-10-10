import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { date, records } = body;
  // records: [{ teacher_id, status }]

  if (!date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Date and at least one teacher record are required" }, { status: 400 });
  }

  const teacherIds = records.map((r: any) => r.teacher_id);

  // Remove existing rows for this date so re-marking updates instead of duplicating
  await supabaseAdmin.from("staff_attendance").delete().eq("date", date).in("teacher_id", teacherIds);

  const rowsToInsert = records.map((r: any) => ({
    teacher_id: r.teacher_id,
    date,
    status: r.status,
    marked_by: auth.userId,
  }));

  const { error } = await supabaseAdmin.from("staff_attendance").insert(rowsToInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, count: rowsToInsert.length });
}
