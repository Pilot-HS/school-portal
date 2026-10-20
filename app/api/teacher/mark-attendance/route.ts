import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";

const VALID_STATUSES = ["present", "absent", "leave"];

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
  if (records.some((r: any) => !VALID_STATUSES.includes(r.status))) {
    return NextResponse.json({ error: "Each status must be present, absent or leave" }, { status: 400 });
  }

  if (!(await canAccessClass(auth, class_id))) return noAccessResponse();

  // Only accept students who really belong to this class
  const { data: classStudents } = await supabaseAdmin.from("students").select("id").eq("class_id", class_id);
  const allowed = new Set((classStudents || []).map((s: any) => s.id));
  const cleanRecords = records.filter((r: any) => allowed.has(r.student_id));
  if (cleanRecords.length === 0) {
    return NextResponse.json({ error: "None of these students belong to the selected class." }, { status: 400 });
  }
  const studentIds = cleanRecords.map((r: any) => r.student_id);

  // Marker (teacher record), if the caller is a teacher
  let markedBy: string | null = null;
  if (auth.role === "teacher") {
    const { data: teacherRow } = await supabaseAdmin
      .from("teachers")
      .select("id")
      .eq("profile_id", auth.userId)
      .maybeSingle();
    markedBy = teacherRow?.id || null;
  }

  // Update rows already saved for this date, insert the rest.
  // Nothing is deleted first, so a failed save can't lose earlier attendance.
  const { data: existing } = await supabaseAdmin
    .from("attendance")
    .select("id, student_id")
    .eq("date", date)
    .in("student_id", studentIds);
  const existingByStudent: Record<string, string> = {};
  (existing || []).forEach((e: any) => {
    existingByStudent[e.student_id] = e.id;
  });

  const updateResults = await Promise.all(
    cleanRecords
      .filter((r: any) => existingByStudent[r.student_id])
      .map((r: any) =>
        supabaseAdmin
          .from("attendance")
          .update({ status: r.status, marked_by: markedBy })
          .eq("id", existingByStudent[r.student_id])
      )
  );
  const updateError = updateResults.find((u) => u.error);
  if (updateError?.error) {
    return NextResponse.json({ error: updateError.error.message }, { status: 400 });
  }

  const rowsToInsert = cleanRecords
    .filter((r: any) => !existingByStudent[r.student_id])
    .map((r: any) => ({ student_id: r.student_id, date, status: r.status, marked_by: markedBy }));

  if (rowsToInsert.length > 0) {
    const { error } = await supabaseAdmin.from("attendance").insert(rowsToInsert);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true, count: cleanRecords.length });
}
