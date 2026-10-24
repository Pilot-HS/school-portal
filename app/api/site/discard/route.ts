import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";

// POST {id} -> throw away the unpublished changes (draft goes back to what is live)
export async function POST(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const { id } = await request.json();
  const { data: page } = await supabaseAdmin.from("site_pages").select("published").eq("id", id).maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  const { data: saved, error } = await supabaseAdmin
    .from("site_pages")
    .update({ draft: page.published, has_unpublished: false, updated_at: new Date().toISOString(), updated_by: auth.userId })
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, sections: page.published, updated_at: saved.updated_at });
}
