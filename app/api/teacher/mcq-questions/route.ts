import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

const cut = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function setupProblem(error: any) {
  const msg = String(error?.message || "");
  if (/mcq_/.test(msg) && /(does not exist|schema cache)/i.test(msg)) {
    return NextResponse.json(
      { error: "The MCQ tables have not been created yet.", setup_needed: true },
      { status: 503 }
    );
  }
  return null;
}

function cleanQuestion(q: any) {
  const row = {
    question_text: cut(q.question_text, 1000),
    option_a: cut(q.option_a, 300),
    option_b: cut(q.option_b, 300),
    option_c: cut(q.option_c, 300),
    option_d: cut(q.option_d, 300),
    correct_option: String(q.correct_option || "").toUpperCase(),
    class_id: q.class_id ? String(q.class_id) : null,
    subject_id: q.subject_id ? String(q.subject_id) : null,
    topic: q.topic ? cut(q.topic, 100) : null,
  };
  if (!row.question_text || !row.option_a || !row.option_b || !row.option_c || !row.option_d) return null;
  if (!["A", "B", "C", "D"].includes(row.correct_option)) return null;
  return row;
}

export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  let query = supabaseAdmin.from("mcq_questions").select("*").order("created_at", { ascending: false }).limit(500);
  if (p.get("class_id")) query = query.eq("class_id", p.get("class_id")!);
  if (p.get("subject_id")) query = query.eq("subject_id", p.get("subject_id")!);
  const search = (p.get("q") || "").replace(/[%_,()]/g, " ").trim();
  if (search) query = query.ilike("question_text", `%${search}%`);

  const [qRes, sRes] = await Promise.all([query, supabaseAdmin.from("subjects").select("id, name").order("name")]);
  if (qRes.error) {
    return setupProblem(qRes.error) || NextResponse.json({ error: qRes.error.message }, { status: 400 });
  }
  return NextResponse.json({ questions: qRes.data || [], subjects: sRes.data || [] });
}

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const list = Array.isArray(body.questions) ? body.questions : [];
  if (list.length === 0) return NextResponse.json({ error: "No questions were sent." }, { status: 400 });
  if (list.length > 200) return NextResponse.json({ error: "Please add at most 200 questions at a time." }, { status: 400 });

  const rows = [];
  for (let i = 0; i < list.length; i++) {
    const row = cleanQuestion(list[i]);
    if (!row) return NextResponse.json({ error: `Question ${i + 1} is incomplete. Each needs a question, four options and a correct answer.` }, { status: 400 });
    rows.push({ ...row, created_by: auth.userId });
  }

  const { error } = await supabaseAdmin.from("mcq_questions").insert(rows);
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, count: rows.length });
}

async function ownerCheck(id: string, auth: { userId: string; role: string }) {
  const { data } = await supabaseAdmin.from("mcq_questions").select("id, created_by").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Question not found" }, { status: 404 });
  if (auth.role !== "admin" && data.created_by !== auth.userId) {
    return NextResponse.json({ error: "You can only change questions you added yourself." }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Question id is required" }, { status: 400 });
  const blocked = await ownerCheck(String(body.id), auth);
  if (blocked) return blocked;

  const row = cleanQuestion(body);
  if (!row) return NextResponse.json({ error: "Each question needs text, four options and a correct answer." }, { status: 400 });
  const { error } = await supabaseAdmin.from("mcq_questions").update(row).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Question id is required" }, { status: 400 });
  const blocked = await ownerCheck(String(body.id), auth);
  if (blocked) return blocked;

  const { error } = await supabaseAdmin.from("mcq_questions").delete().eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
