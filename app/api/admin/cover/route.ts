import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

function setupProblem(error: any) {
  const msg = String(error?.message || "");
  if (/teacher_cover/.test(msg) && /(does not exist|schema cache)/i.test(msg)) {
    return NextResponse.json({ error: "The cover table has not been created yet.", setup_needed: true }, { status: 503 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [cover, teachers, classes] = await Promise.all([
    supabaseAdmin.from("teacher_cover").select("*").order("start_date", { ascending: false }).limit(200),
    supabaseAdmin.from("teachers").select("id, full_name, is_active").order("full_name"),
    supabaseAdmin.from("classes").select("id, name, grade, section"),
  ]);
  if (cover.error) return setupProblem(cover.error) || NextResponse.json({ error: cover.error.message }, { status: 400 });

  const className: Record<string, string> = {};
  (classes.data || []).forEach((c: any) => {
    className[String(c.id)] = c.name || [c.grade, c.section].filter(Boolean).join("-");
  });
  const teacherName: Record<string, string> = {};
  (teachers.data || []).forEach((t: any) => {
    teacherName[String(t.id)] = t.full_name;
  });

  return NextResponse.json({
    cover: (cover.data || []).map((c: any) => ({
      id: c.id,
      teacher_id: c.teacher_id,
      teacher_name: teacherName[c.teacher_id] || "Unknown teacher",
      class_id: c.class_id,
      class_name: className[c.class_id] || "Unknown class",
      start_date: c.start_date,
      end_date: c.end_date,
      note: c.note,
    })),
    teachers: (teachers.data || []).filter((t: any) => t.is_active !== false).map((t: any) => ({ id: t.id, full_name: t.full_name })),
    classes: (classes.data || []).map((c: any) => ({ id: c.id, label: className[String(c.id)] })),
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { teacher_id, class_id, start_date, end_date } = body;
  if (!teacher_id || !class_id || !start_date || !end_date) {
    return NextResponse.json({ error: "Teacher, class, start date and end date are required." }, { status: 400 });
  }
  if (end_date < start_date) {
    return NextResponse.json({ error: "The end date can't be before the start date." }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("teacher_cover").insert({
    teacher_id: String(teacher_id),
    class_id: String(class_id),
    start_date,
    end_date,
    note: body.note ? String(body.note).slice(0, 200) : null,
    created_by: auth.userId,
  });
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Cover id is required." }, { status: 400 });
  const { error } = await supabaseAdmin.from("teacher_cover").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
