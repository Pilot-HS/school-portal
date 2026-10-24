import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";

// GET ?id= -> earlier published versions of a page (newest first)
export async function GET(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("site_versions").select("id, created_at, created_by, note").eq("page_id", id).order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = Array.from(new Set((data || []).map((v: any) => v.created_by).filter(Boolean)));
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", ids);
    (profiles || []).forEach((p: any) => (names[p.id] = p.full_name));
  }
  return NextResponse.json({ versions: (data || []).map((v: any) => ({ id: v.id, created_at: v.created_at, by: names[v.created_by] || "—", note: v.note })) });
}
