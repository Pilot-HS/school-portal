import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { fetchAllRows } from "@/lib/fetchAll";
import { canAccessClass, noAccessResponse, todayInSchool } from "@/lib/teacherAccess";
import { holidaysBetween } from "@/lib/holidays";
import { datesBetween } from "@/lib/attendanceStats";
import { getAttendanceSettings } from "@/lib/settings";

export const maxDuration = 60;

// Attendance of a class (teacher/admin) or of one student (student/parent: their own) between two dates.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["student", "parent", "teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  const from = p.get("from") || "";
  const to = p.get("to") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) {
    return NextResponse.json({ error: "Choose a valid from and to date." }, { status: 400 });
  }
  if (datesBetween(from, to, 401).length > 400) {
    return NextResponse.json({ error: "Please choose a range of up to 13 months." }, { status: 400 });
  }

  const studentId = p.get("student_id");
  let classId = p.get("class_id");
  const cols = "id, full_name, roll_no, gr_number, class_id, profile_id, parent_profile_id, is_active, classes(name, grade, section)";
  let students: any[] = [];
  let classRow: any = null;

  if (studentId) {
    const { data } = await supabaseAdmin.from("students").select(cols).eq("id", studentId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (auth.role === "student" && data.profile_id !== auth.userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (auth.role === "parent" && data.parent_profile_id !== auth.userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (auth.role === "teacher" && !(await canAccessClass(auth, data.class_id))) return noAccessResponse();
    students = [data];
    classId = data.class_id;
    classRow = data.classes;
  } else {
    if (auth.role === "student" || auth.role === "parent") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (!classId) return NextResponse.json({ error: "Choose a class." }, { status: 400 });
    if (!(await canAccessClass(auth, classId))) return noAccessResponse();
    const { data, error } = await supabaseAdmin.from("students").select(cols).eq("class_id", classId).order("roll_no");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    students = (data || []).filter((s: any) => s.is_active !== false);
    classRow = students[0]?.classes || null;
    if (!classRow) {
      const { data: c } = await supabaseAdmin.from("classes").select("name, grade, section").eq("id", classId).maybeSingle();
      classRow = c;
    }
  }

  const ids = students.map((s) => s.id);
  let rows: any[] = [];
  if (ids.length > 0) {
    try {
      rows = await fetchAllRows((a, b) =>
        supabaseAdmin.from("attendance").select("student_id, date, status").in("student_id", ids).gte("date", from).lte("date", to).range(a, b)
      );
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Could not load attendance." }, { status: 400 });
    }
  }
  const records: Record<string, Record<string, string>> = {};
  rows.forEach((r) => {
    (records[r.student_id] = records[r.student_id] || {})[r.date] = r.status;
  });

  const [holidays, { lowThreshold }] = await Promise.all([holidaysBetween(from, to, classId), getAttendanceSettings()]);

  return NextResponse.json({
    today: todayInSchool(),
    low_threshold: lowThreshold,
    class_id: classId,
    class_name: classRow ? classRow.name || [classRow.grade, classRow.section].filter(Boolean).join("-") : "",
    students: students.map((s) => ({ id: s.id, full_name: s.full_name, roll_no: s.roll_no, gr_number: s.gr_number })),
    records,
    holidays,
  });
}
