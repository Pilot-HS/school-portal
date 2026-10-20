import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";
import { fetchAllRows } from "@/lib/fetchAll";

// Students of a class with their attendance over the last 30 days.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const classId = new URL(request.url).searchParams.get("class_id");
  if (!classId) {
    return NextResponse.json({ error: "Class is required" }, { status: 400 });
  }

  if (!(await canAccessClass(auth, classId))) return noAccessResponse();

  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select("id, full_name, roll_no, gr_number, house, is_active")
    .eq("class_id", classId)
    .order("roll_no");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const active = (students || []).filter((s: any) => s.is_active !== false);
  const ids = active.map((s: any) => s.id);

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceISO = since.toISOString().slice(0, 10);

  let rows: any[] = [];
  if (ids.length > 0) {
    try {
      rows = await fetchAllRows((from, to) =>
        supabaseAdmin.from("attendance").select("student_id, status").in("student_id", ids).gte("date", sinceISO).range(from, to)
      );
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Could not load attendance" }, { status: 400 });
    }
  }

  const tally: Record<string, { present: number; absent: number; leave: number }> = {};
  rows.forEach((r) => {
    if (!tally[r.student_id]) tally[r.student_id] = { present: 0, absent: 0, leave: 0 };
    if (r.status === "present") tally[r.student_id].present++;
    else if (r.status === "absent") tally[r.student_id].absent++;
    else if (r.status === "leave") tally[r.student_id].leave++;
  });

  return NextResponse.json({
    students: active.map((s: any) => {
      const t = tally[s.id] || { present: 0, absent: 0, leave: 0 };
      const total = t.present + t.absent + t.leave;
      return {
        id: s.id,
        full_name: s.full_name,
        roll_no: s.roll_no,
        gr_number: s.gr_number || null,
        house: s.house || null,
        ...t,
        total,
        pct: total > 0 ? Math.round((t.present / total) * 100) : null,
      };
    }),
  });
}
