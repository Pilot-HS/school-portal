import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { logAudit } from "@/lib/audit";
import { SEED } from "@/lib/site/seedData";

const missing = (e: any) => /(does not exist|schema cache)/i.test(String(e?.message || ""));

// GET  -> is the website set up? how many pages?
// POST -> fills the new website with the school's current content (only if it is still empty)
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .select("id, slug, parent_id, title, menu_label, position, is_home, show_in_menu, has_unpublished")
    .order("position");
  if (error) {
    return NextResponse.json({ tables_ready: !missing(error) ? true : false, pages: [], error: missing(error) ? null : error.message });
  }
  return NextResponse.json({ tables_ready: true, pages: data || [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { count, error: countError } = await supabaseAdmin.from("site_pages").select("id", { count: "exact", head: true });
  if (countError) {
    return NextResponse.json(
      { error: missing(countError) ? "The website tables don't exist yet. Run setup-database.sql in Supabase first." : countError.message, setup_needed: missing(countError) },
      { status: missing(countError) ? 503 : 400 }
    );
  }
  if ((count || 0) > 0) return NextResponse.json({ error: "The website already has pages, so nothing was changed." }, { status: 400 });

  const now = new Date().toISOString();
  const rows = (SEED.pages as any[]).map((p) => ({
    slug: p.slug,
    title: p.title,
    menu_label: p.menu_label,
    position: p.position,
    show_in_menu: p.show_in_menu,
    is_home: p.is_home,
    seo_description: p.seo_description || null,
    draft: p.sections,
    published: p.sections,
    has_unpublished: false,
    published_at: now,
    updated_by: auth.userId,
  }));
  const { error } = await supabaseAdmin.from("site_pages").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const settingsRows = Object.entries(SEED.settings as Record<string, any>).map(([key, value]) => ({ key, draft: value, published: value, updated_at: now }));
  const { error: sError } = await supabaseAdmin.from("site_settings").upsert(settingsRows, { onConflict: "key" });
  if (sError) return NextResponse.json({ error: sError.message }, { status: 400 });

  await logAudit(auth.userId, "website", `Loaded the current website content (${rows.length} pages)`);
  return NextResponse.json({ success: true, pages: rows.length });
}
