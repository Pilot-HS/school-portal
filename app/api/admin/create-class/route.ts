import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { grade, section } = body;

  if (!grade || !section) {
    return NextResponse.json({ error: "Grade and section are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("classes")
    .insert({ grade, section })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, class: data });
}
