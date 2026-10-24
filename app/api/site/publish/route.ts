import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { logAudit } from "@/lib/audit";

// POST {id} -> make the draft live. Keeps the last 30 published versions so any can be restored.
export async function POST(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });
  const { data: page } = await supabaseAdmin.from("site_pages").select("id, title, draft").eq("id", id).maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("site_pages").update({ published: page.draft, has_unpublished: false, published_at: now, updated_by: auth.userId }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from("site_versions").insert({ page_id: id, created_by: auth.userId, content: page.draft, note: "Published" });
  const { data: old } = await supabaseAdmin.from("site_versions").select("id").eq("page_id", id).order("created_at", { ascending: false }).range(30, 200);
  if (old && old.length) await supabaseAdmin.from("site_versions").delete().in("id", old.map((v: any) => v.id));

  await logAudit(auth.userId, "website", `Published the website page "${page.title}"`, { page_id: id });
  try {
    revalidatePath("/", "layout");
  } catch {
    /* pages are always rendered fresh anyway */
  }
  return NextResponse.json({ success: true, published_at: now });
}
