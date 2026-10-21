import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { canAccessClass, getAllowedClassIds, noAccessResponse } from "@/lib/teacherAccess";
import { logAudit } from "@/lib/audit";
import { datesBetween, isSunday } from "@/lib/attendanceStats";

function setupProblem(error: any) {
  const msg = String(error?.message || "");
  if (/school_holidays/.test(msg) && /(does not exist|schema cache)/i.test(msg)) {
    return NextResponse.json({ error: "The holidays table has not been created yet.", setup_needed: true }, { status: 503 });
  }
  return null;
}

async function classNames() {
  const { data } = await supabaseAdmin.from("classes").select("id, name, grade, section");
  const out: Record<string, string> = {};
  (data || []).forEach((c: any) => {
    out[String(c.id)] = c.name || [c.grade, c.section].filter(Boolean).join("-");
  });
  return out;
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  const from = p.get("from") || new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
  const to = p.get("to") || new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("school_holidays")
    .select("*")
    .gte("holiday_date", from)
    .lte("holiday_date", to)
    .order("holiday_date", { ascending: false })
    .limit(500);
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });

  let rows = data || [];
  let mine: string[] | null = null;
  if (auth.role === "teacher") {
    mine = (await getAllowedClassIds(auth.userId)).classIds;
    rows = rows.filter((h: any) => !h.class_id || mine!.includes(String(h.class_id)));
  }
  const names = await classNames();
  return NextResponse.json({
    holidays: rows.map((h: any) => ({
      id: h.id,
      holiday_date: h.holiday_date,
      reason: h.reason,
      class_id: h.class_id,
      scope: h.class_id ? `Class ${names[String(h.class_id)] || ""}` : "Whole school",
      can_delete: auth.role === "admin" || (!!h.class_id && !!mine && mine.includes(String(h.class_id))),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const from: string = body.from_date;
  const to: string = body.to_date || body.from_date;
  const reason = String(body.reason || "").trim().slice(0, 150);
  const classId: string | null = body.class_id ? String(body.class_id) : null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "") || to < from) {
    return NextResponse.json({ error: "Choose a valid date (or from and to dates)." }, { status: 400 });
  }
  if (reason.length < 3) return NextResponse.json({ error: "Please write the reason for the holiday." }, { status: 400 });
  if (auth.role === "teacher") {
    if (!classId) return NextResponse.json({ error: "Teachers can mark a holiday for their own class. Ask the admin for a whole-school holiday." }, { status: 403 });
    if (!(await canAccessClass(auth, classId))) return noAccessResponse();
  }

  const dates = datesBetween(from, to, 60).filter((d) => !isSunday(d)); // Sundays are already shown as Sunday
  if (dates.length === 0) return NextResponse.json({ error: "Those dates are all Sundays, which are already marked." }, { status: 400 });

  const { data: existing, error: exError } = await supabaseAdmin.from("school_holidays").select("holiday_date, class_id").in("holiday_date", dates);
  if (exError) return setupProblem(exError) || NextResponse.json({ error: exError.message }, { status: 400 });
  const have = new Set((existing || []).filter((h: any) => (h.class_id ? String(h.class_id) : null) === classId).map((h: any) => h.holiday_date));
  const rows = dates.filter((d) => !have.has(d)).map((d) => ({ holiday_date: d, reason, class_id: classId, created_by: auth.userId }));
  if (rows.length === 0) return NextResponse.json({ error: "Those dates are already marked as holidays." }, { status: 400 });

  const { error } = await supabaseAdmin.from("school_holidays").insert(rows);
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit(auth.userId, "holidays", `Marked ${rows.length} day${rows.length === 1 ? "" : "s"} as holiday (${reason})`, { from, to, class_id: classId });
  return NextResponse.json({ success: true, count: rows.length });
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Holiday id is required." }, { status: 400 });
  const { data: h } = await supabaseAdmin.from("school_holidays").select("*").eq("id", id).maybeSingle();
  if (!h) return NextResponse.json({ error: "Holiday not found." }, { status: 404 });
  if (auth.role === "teacher") {
    if (!h.class_id) return NextResponse.json({ error: "Only the admin can remove a whole-school holiday." }, { status: 403 });
    if (!(await canAccessClass(auth, h.class_id))) return noAccessResponse();
  }
  const { error } = await supabaseAdmin.from("school_holidays").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(auth.userId, "holidays", `Removed holiday on ${h.holiday_date} (${h.reason})`, { id });
  return NextResponse.json({ success: true });
}
