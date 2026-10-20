import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

const cut = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function setupProblem(error: any) {
  const msg = String(error?.message || "");
  if (/mcq_/.test(msg) && /(does not exist|schema cache)/i.test(msg)) {
    return NextResponse.json({ error: "The MCQ tables have not been created yet.", setup_needed: true }, { status: 503 });
  }
  return null;
}

async function names() {
  const [c, s] = await Promise.all([
    supabaseAdmin.from("classes").select("id, name, grade, section"),
    supabaseAdmin.from("subjects").select("id, name"),
  ]);
  const classes: Record<string, string> = {};
  (c.data || []).forEach((x: any) => {
    classes[String(x.id)] = x.name || [x.grade, x.section].filter(Boolean).join("-");
  });
  const subjects: Record<string, string> = {};
  (s.data || []).forEach((x: any) => {
    subjects[String(x.id)] = x.name;
  });
  return { classes, subjects };
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  const { classes, subjects } = await names();

  if (id) {
    const { data, error } = await supabaseAdmin.from("mcq_papers").select("*").eq("id", id).maybeSingle();
    if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    return NextResponse.json({
      paper: data,
      class_name: data.class_id ? classes[data.class_id] || "" : "",
      subject_name: data.subject_id ? subjects[data.subject_id] || "" : "",
      can_edit: auth.role === "admin" || data.created_by === auth.userId,
    });
  }

  const { data, error } = await supabaseAdmin
    .from("mcq_papers")
    .select("id, created_at, created_by, title, class_id, subject_id, questions")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    papers: (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      created_at: p.created_at,
      count: Array.isArray(p.questions) ? p.questions.length : 0,
      class_name: p.class_id ? classes[p.class_id] || "" : "",
      subject_name: p.subject_id ? subjects[p.subject_id] || "" : "",
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const title = cut(body.title, 150);
  const ids: string[] = Array.isArray(body.question_ids) ? body.question_ids.map(String) : [];
  const marks = Number(body.marks_per_question);

  if (!title) return NextResponse.json({ error: "Please give the paper a title." }, { status: 400 });
  if (ids.length < 1) return NextResponse.json({ error: "Choose at least one question." }, { status: 400 });
  if (ids.length > 100) return NextResponse.json({ error: "A paper can have at most 100 questions." }, { status: 400 });
  if (!Number.isFinite(marks) || marks <= 0 || marks > 100) return NextResponse.json({ error: "Marks per question must be more than 0." }, { status: 400 });

  const { data: rows, error: qError } = await supabaseAdmin.from("mcq_questions").select("*").in("id", ids);
  if (qError) return setupProblem(qError) || NextResponse.json({ error: qError.message }, { status: 400 });

  const byId: Record<string, any> = {};
  (rows || []).forEach((r: any) => {
    byId[r.id] = r;
  });
  const snapshot = ids
    .filter((i) => byId[i])
    .map((i) => ({
      id: i,
      text: byId[i].question_text,
      options: [byId[i].option_a, byId[i].option_b, byId[i].option_c, byId[i].option_d],
      correct: byId[i].correct_option,
    }));
  if (snapshot.length !== ids.length) {
    return NextResponse.json({ error: "Some chosen questions no longer exist. Please reload and choose again." }, { status: 400 });
  }

  const duration = body.duration_minutes ? Math.round(Number(body.duration_minutes)) : null;
  const { data, error } = await supabaseAdmin
    .from("mcq_papers")
    .insert({
      title,
      class_id: body.class_id ? String(body.class_id) : null,
      subject_id: body.subject_id ? String(body.subject_id) : null,
      instructions: body.instructions ? cut(body.instructions, 1000) : null,
      duration_minutes: duration && duration > 0 && duration < 1000 ? duration : null,
      marks_per_question: marks,
      questions: snapshot,
      created_by: auth.userId,
    })
    .select("id")
    .single();
  if (error || !data) return setupProblem(error) || NextResponse.json({ error: error?.message || "Could not create the paper" }, { status: 400 });

  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Paper id is required" }, { status: 400 });
  const { data } = await supabaseAdmin.from("mcq_papers").select("id, created_by").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Paper not found" }, { status: 404 });
  if (auth.role !== "admin" && data.created_by !== auth.userId) {
    return NextResponse.json({ error: "You can only delete papers you created yourself." }, { status: 403 });
  }
  const { error } = await supabaseAdmin.from("mcq_papers").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
