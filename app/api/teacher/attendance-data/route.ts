import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";
import { fetchAllRows } from "@/lib/fetchAll";

// For one class: its students, what was already marked on a date,
// and a day-by-day summary of the last 30 days.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = new URL(request.url).searchParams;
  const classId = params.get("class_id");
  const date = params.get("date");
  if (!classId || !date) {
    return NextResponse.json({ error: "Class and date are required" }, { status: 400 });
  }

  if (!(await canAccessClass(auth, classId))) return noAccessResponse();

  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select("id, full_name, roll_no, is_active")
    .eq("class_id", classId)
    .order("roll_no");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const activeStudents = (students || []).filter((s: any) => s.is_active !== false);
  const ids = activeStudents.map((s: any) => s.id);
  if (ids.length === 0) {
    return NextResponse.json({ students: [], records: {}, history: [] });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  let rows: any[] = [];
  try {
    rows = await fetchAllRows((from, to) =>
      supabaseAdmin
        .from("attendance")
        .select("student_id, date, status")
        .in("student_id", ids)
        .gte("date", sinceISO)
        .range(from, to)
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load attendance" }, { status: 400 });
  }

  const records: Record<string, string> = {};
  const byDate: Record<string, { present: number; absent: number; leave: number }> = {};
  rows.forEach((r) => {
    if (r.date === date) records[r.student_id] = r.status;
    if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0, leave: 0 };
    if (r.status === "present") byDate[r.date].present++;
    else if (r.status === "absent") byDate[r.date].absent++;
    else if (r.status === "leave") byDate[r.date].leave++;
  });
  const history = Object.keys(byDate)
    .sort()
    .reverse()
    .slice(0, 14)
    .map((d) => ({ date: d, ...byDate[d] }));

  return NextResponse.json({
    students: activeStudents.map((s: any) => ({ id: s.id, full_name: s.full_name, roll_no: s.roll_no })),
    records,
    history,
  });
}
