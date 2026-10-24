import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { cleanSections } from "@/lib/site/validate";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// GET ?id=  -> the page's draft, ready to edit
export async function GET(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });

  const [{ data: page, error }, { data: settings }] = await Promise.all([
    supabaseAdmin.from("site_pages").select("id, slug, title, seo_description, draft, published, has_unpublished, updated_at, published_at").eq("id", id).maybeSingle(),
    supabaseAdmin.from("site_settings").select("key, draft, published"),
  ]);
  if (error || !page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  const st: Record<string, any> = {};
  (settings || []).forEach((r: any) => (st[r.key] = r.draft || r.published));
  return NextResponse.json({ page, settings: st, access: auth.access });
}

// PUT -> save the draft (the live site does not change until Publish)
export async function PUT(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "Page id is required." }, { status: 400 });

  const clean = cleanSections(body.sections);
  if (!clean.ok) return NextResponse.json({ error: clean.error }, { status: 400 });

  const { data: page } = await supabaseAdmin.from("site_pages").select("id, title, seo_description, published, updated_at").eq("id", id).maybeSingle();
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  // Someone else saved this page since it was opened
  if (body.base_updated_at && page.updated_at && new Date(page.updated_at).getTime() !== new Date(body.base_updated_at).getTime()) {
    return NextResponse.json({ error: "Someone else has changed this page since you opened it. Please reload the page to see their changes.", conflict: true }, { status: 409 });
  }

  const patch: any = {
    draft: clean.sections,
    has_unpublished: !same(clean.sections, page.published),
    updated_at: new Date().toISOString(),
    updated_by: auth.userId,
  };
  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.replace(/<[^>]*>/g, "").trim().slice(0, 150);
  if (typeof body.seo_description === "string") patch.seo_description = body.seo_description.replace(/<[^>]*>/g, "").trim().slice(0, 300) || null;

  const { data: saved, error } = await supabaseAdmin.from("site_pages").update(patch).eq("id", id).select("updated_at, has_unpublished").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, updated_at: saved.updated_at, has_unpublished: saved.has_unpublished });
}
