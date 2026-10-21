import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, noAccessResponse, todayInSchool } from "@/lib/teacherAccess";
import { holidayOn } from "@/lib/holidays";
import { getAttendanceSettings } from "@/lib/settings";
import { addDays, isSunday } from "@/lib/attendanceStats";

const VALID_STATUSES = ["present", "late", "absent", "leave"];

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { class_id, date, records } = body;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
  // records: [{ student_id, status }]

  if (!class_id || !date || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: "Class, date, and at least one student record are required" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "That date isn't valid." }, { status: 400 });
  }
  if (records.some((r: any) => !VALID_STATUSES.includes(r.status))) {
    return NextResponse.json({ error: "Each status must be present, late, absent or leave" }, { status: 400 });
  }
  if (!(await canAccessClass(auth, class_id))) return noAccessResponse();

  // Date rules
  const today = todayInSchool();
  if (date > today) return NextResponse.json({ error: "Attendance can't be marked for a future date." }, { status: 400 });
  if (isSunday(date)) return NextResponse.json({ error: "That date is a Sunday, so there is no attendance to mark." }, { status: 400 });
  const holiday = await holidayOn(date, String(class_id));
  if (holiday) return NextResponse.json({ error: `That date is a holiday (${holiday}). Remove the holiday first if school was open.` }, { status: 400 });
  if (auth.role === "teacher") {
    const { lockDays } = await getAttendanceSettings();
    if (lockDays > 0 && date < addDays(today, -lockDays)) {
      return NextResponse.json({ error: `Attendance older than ${lockDays} days is locked. Please ask the admin to change it.` }, { status: 403 });
    }
  }

  // Only accept students who really belong to this class
  const { data: classStudents } = await supabaseAdmin.from("students").select("id, full_name").eq("class_id", class_id);
  const allowed = new Set((classStudents || []).map((s: any) => s.id));
  const nameOf: Record<string, string> = {};
  (classStudents || []).forEach((s: any) => {
    nameOf[s.id] = s.full_name;
  });
  const cleanRecords = records.filter((r: any) => allowed.has(r.student_id));
  if (cleanRecords.length === 0) {
    return NextResponse.json({ error: "None of these students belong to the selected class." }, { status: 400 });
  }
  const studentIds = cleanRecords.map((r: any) => r.student_id);

  // Marker (teacher record), if the caller is a teacher
  let markedBy: string | null = null;
  if (auth.role === "teacher") {
    const { data: teacherRow } = await supabaseAdmin.from("teachers").select("id").eq("profile_id", auth.userId).maybeSingle();
    markedBy = teacherRow?.id || null;
  }

  // Update rows already saved for this date, insert the rest.
  // Nothing is deleted first, so a failed save can't lose earlier attendance.
  const { data: existing } = await supabaseAdmin.from("attendance").select("id, student_id, status").eq("date", date).in("student_id", studentIds);
  const existingByStudent: Record<string, string> = {};
  const oldStatus: Record<string, string> = {};
  (existing || []).forEach((e: any) => {
    existingByStudent[e.student_id] = e.id;
    oldStatus[e.student_id] = e.status;
  });

  const lateHelp = "The Late status needs a one-time database update. Ask the admin to run setup-database.sql in Supabase.";
  const friendly = (message: string) => (/invalid input value|violates check constraint|enum/i.test(message) && cleanRecords.some((r: any) => r.status === "late") ? lateHelp : message);

  const updateResults = await Promise.all(
    cleanRecords
      .filter((r: any) => existingByStudent[r.student_id])
      .map((r: any) => {
        const patch: any = { status: r.status };
        if (markedBy) patch.marked_by = markedBy; // an admin's edit keeps the original teacher's name
        return supabaseAdmin.from("attendance").update(patch).eq("id", existingByStudent[r.student_id]);
      })
  );
  const updateError = updateResults.find((u) => u.error);
  if (updateError?.error) {
    return NextResponse.json({ error: friendly(updateError.error.message) }, { status: 400 });
  }

  const rowsToInsert = cleanRecords
    .filter((r: any) => !existingByStudent[r.student_id])
    .map((r: any) => ({ student_id: r.student_id, date, status: r.status, marked_by: markedBy }));

  if (rowsToInsert.length > 0) {
    const { error } = await supabaseAdmin.from("attendance").insert(rowsToInsert);
    if (error) {
      return NextResponse.json({ error: friendly(error.message) }, { status: 400 });
    }
  }

  const changed = cleanRecords
    .filter((r: any) => oldStatus[r.student_id] && oldStatus[r.student_id] !== r.status)
    .map((r: any) => ({ student: nameOf[r.student_id] || r.student_id, from: oldStatus[r.student_id], to: r.status }));
  await logAudit(
    auth.userId,
    "attendance",
    `${auth.role === "admin" ? "Admin " : ""}${changed.length > 0 ? "edited" : "marked"} attendance for ${cleanRecords.length} student${cleanRecords.length === 1 ? "" : "s"} on ${date}${changed.length ? ` (${changed.length} changed)` : ""}${reason ? ` — ${reason}` : ""}`,
    { date, class_id, saved: cleanRecords.length, new: rowsToInsert.length, reason: reason || null, changed: changed.slice(0, 40) }
  );

  return NextResponse.json({ success: true, count: cleanRecords.length });
}
