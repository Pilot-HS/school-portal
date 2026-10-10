import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const { name } = body;
  if (!name) {
    return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
  }
  const { data: existing } = await supabaseAdmin.from("subjects").select("id").eq("name", name).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `Subject "${name}" already exists.` }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin.from("subjects").insert({ name }).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, subject: data });
}
