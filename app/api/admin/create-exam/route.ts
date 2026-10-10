import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const { name, term, academic_year_id, start_date, end_date } = body;
  if (!name) {
    return NextResponse.json({ error: "Exam name is required" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("exams")
    .insert({
      name,
      term: term || null,
      academic_year_id: academic_year_id || null,
      start_date: start_date || null,
      end_date: end_date || null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, exam: data });
}
