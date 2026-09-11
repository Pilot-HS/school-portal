import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { class_id, date, records } = body;
  // records: [{ student_id, status }]

  if (!class_id || !date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Class, date, and at least one student record are required" }, { status: 400 });
  }

  const studentIds = records.map((r: any) => r.student_id);

  // Remove any existing attendance rows for this class's students on this date,
  // so re-submitting the same day updates instead of duplicating.
  await supabaseAdmin.from("attendance").delete().eq("date", date).in("student_id", studentIds);

  // Find (or leave null) a teacher record for the marker, if they are a teacher
  let markedBy: string | null = null;
  if (auth.role === "teacher") {
    const { data: teacherRow } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .eq("profile_id", auth.userId)
      .single();
    markedBy = teacherRow?.id || null;
  }

  const rowsToInsert = records.map((r: any) => ({
    student_id: r.student_id,
    date,
    status: r.status,
    marked_by: markedBy,
  }));

  const { error } = await supabaseAdmin.from("attendance").insert(rowsToInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, count: rowsToInsert.length });
}
