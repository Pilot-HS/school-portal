import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";
import { holidaysBetween } from "@/lib/holidays";
import { isSunday } from "@/lib/attendanceStats";

export const maxDuration = 60;

// One date, every class: marked or not, counts, who marked it, and who is absent.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const date = new URL(request.url).searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Choose a valid date." }, { status: 400 });

  try {
    const [classesRes, students, rows, teachersRes, timetable, holidays] = await Promise.all([
      supabaseAdmin.from("classes").select("id, name, grade, section").order("grade"),
      fetchAllRows((a, b) => supabaseAdmin.from("students").select("id, full_name, roll_no, class_id, is_active").range(a, b)),
      fetchAllRows((a, b) => supabaseAdmin.from("attendance").select("student_id, status, marked_by").eq("date", date).range(a, b)),
      supabaseAdmin.from("teachers").select("id, full_name"),
      fetchAllRows((a, b) => supabaseAdmin.from("timetable_entries").select("class_id, teacher_id").range(a, b)),
      holidaysBetween(date, date, null),
    ]);

    const teacherName: Record<string, string> = {};
    (teachersRes.data || []).forEach((t: any) => {
      teacherName[String(t.id)] = t.full_name;
    });
    const active = students.filter((s: any) => s.is_active !== false);
    const byStudent: Record<string, { status: string; marked_by: string | null }> = {};
    rows.forEach((r: any) => {
      byStudent[r.student_id] = { status: r.status, marked_by: r.marked_by ? String(r.marked_by) : null };
    });
    const classTeachers: Record<string, Set<string>> = {};
    timetable.forEach((t: any) => {
      if (!t.class_id || !t.teacher_id) return;
      (classTeachers[String(t.class_id)] = classTeachers[String(t.class_id)] || new Set()).add(String(t.teacher_id));
    });

    const sunday = isSunday(date);
    const classes = (classesRes.data || []).map((c: any) => {
      const id = String(c.id);
      const label = c.name || [c.grade, c.section].filter(Boolean).join("-");
      const kids = active.filter((s: any) => String(s.class_id) === id);
      const counts = { present: 0, late: 0, absent: 0, leave: 0 };
      const markers = new Set<string>();
      const absentNames: string[] = [];
      let marked = 0;
      kids.forEach((s: any) => {
        const r = byStudent[s.id];
        if (!r) return;
        marked++;
        if (r.status in counts) (counts as any)[r.status]++;
        if (r.marked_by) markers.add(r.marked_by);
        if (r.status === "absent") absentNames.push(`${s.roll_no}. ${s.full_name}`);
      });
      const holiday = holidays.find((h) => h.class_id === null || h.class_id === id);
      return {
        class_id: id,
        name: label,
        total: kids.length,
        marked,
        ...counts,
        pct: marked > 0 ? Math.round(((counts.present + counts.late) / marked) * 100) : null,
        status: sunday ? "sunday" : holiday ? "holiday" : kids.length === 0 ? "empty" : marked === 0 ? "not_marked" : marked < kids.length ? "partial" : "marked",
        holiday_reason: holiday ? holiday.reason : null,
        marked_by: Array.from(markers).map((m) => teacherName[m] || "Teacher"),
        teachers: Array.from(classTeachers[id] || []).map((t) => teacherName[t]).filter(Boolean),
        absentees: absentNames,
      };
    });

    return NextResponse.json({ date, is_sunday: sunday, classes });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load the overview." }, { status: 500 });
  }
}
