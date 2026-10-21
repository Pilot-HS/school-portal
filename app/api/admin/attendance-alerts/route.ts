import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";
import { holidaysBetween } from "@/lib/holidays";
import { getAttendanceSettings } from "@/lib/settings";
import { todayInSchool } from "@/lib/teacherAccess";
import { addDays, currentAbsentStreak, dayInfos, totalsFor } from "@/lib/attendanceStats";

export const maxDuration = 60;

// Students below the attendance limit and students absent several days in a row.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  const today = todayInSchool();
  const to = /^\d{4}-\d{2}-\d{2}$/.test(p.get("to") || "") ? p.get("to")! : today;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(p.get("from") || "") ? p.get("from")! : addDays(to, -29);
  const classFilter = p.get("class_id");

  try {
    const { lowThreshold } = await getAttendanceSettings();
    const [classesRes, students, holidays] = await Promise.all([
      supabaseAdmin.from("classes").select("id, name, grade, section"),
      fetchAllRows((a, b) => {
        let q = supabaseAdmin.from("students").select("id, full_name, roll_no, class_id, is_active").range(a, b);
        if (classFilter) q = q.eq("class_id", classFilter);
        return q;
      }),
      holidaysBetween(from, to, null),
    ]);
    const active = students.filter((s: any) => s.is_active !== false);
    const ids = active.map((s: any) => s.id);
    const rows: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      rows.push(
        ...(await fetchAllRows((a, b) => supabaseAdmin.from("attendance").select("student_id, date, status").in("student_id", chunk).gte("date", from).lte("date", to).range(a, b)))
      );
    }
    const recs: Record<string, Record<string, string>> = {};
    rows.forEach((r) => ((recs[r.student_id] = recs[r.student_id] || {})[r.date] = r.status));

    const className: Record<string, string> = {};
    (classesRes.data || []).forEach((c: any) => {
      className[String(c.id)] = c.name || [c.grade, c.section].filter(Boolean).join("-");
    });

    const low: any[] = [];
    const streaks: any[] = [];
    const dayCache: Record<string, ReturnType<typeof dayInfos>> = {};
    active.forEach((s: any) => {
      const cid = String(s.class_id);
      const days = (dayCache[cid] = dayCache[cid] || dayInfos(from, to, holidays, cid, today));
      const t = totalsFor(days, recs[s.id]);
      const base = { id: s.id, name: s.full_name, roll_no: s.roll_no, class_name: className[cid] || "" };
      if (t.marked >= 5 && t.pct !== null && t.pct < lowThreshold) low.push({ ...base, pct: t.pct, absent: t.absent, marked: t.marked });
      const st = currentAbsentStreak(days, recs[s.id]);
      if (st.count >= 3) streaks.push({ ...base, days: st.count, since: st.since });
    });
    low.sort((a, b) => a.pct - b.pct);
    streaks.sort((a, b) => b.days - a.days);

    return NextResponse.json({ from, to, threshold: lowThreshold, low, streaks });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not work out the alerts." }, { status: 500 });
  }
}
