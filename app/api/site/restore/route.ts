import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { logAudit } from "@/lib/audit";

// POST {id, version_id} -> put an earlier version back into the draft (publish it to make it live)
export async function POST(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const { id, version_id } = await request.json();
  if (!id || !version_id) return NextResponse.json({ error: "Choose a version." }, { status: 400 });

  const [{ data: version }, { data: page }] = await Promise.all([
    supabaseAdmin.from("site_versions").select("content").eq("id", version_id).eq("page_id", id).maybeSingle(),
    supabaseAdmin.from("site_pages").select("published").eq("id", id).maybeSingle(),
  ]);
  if (!version || !page) return NextResponse.json({ error: "That version wasn't found." }, { status: 404 });

  const { data: saved, error } = await supabaseAdmin
    .from("site_pages")
    .update({ draft: version.content, has_unpublished: JSON.stringify(version.content) !== JSON.stringify(page.published), updated_at: new Date().toISOString(), updated_by: auth.userId })
    .eq("id", id)
    .select("updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(auth.userId, "website", "Restored an earlier version of a website page (as a draft)", { page_id: id, version_id });
  return NextResponse.json({ success: true, sections: version.content, updated_at: saved.updated_at });
}
