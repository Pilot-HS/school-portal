import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { logAudit } from "@/lib/audit";
import { RESERVED_SLUGS, slugify } from "@/lib/site/util";
import { newSection } from "@/lib/site/templates";

const COLS = "id, slug, parent_id, title, menu_label, position, show_in_menu, is_home, has_unpublished, published_at, updated_at";
const clean = (v: unknown, max: number) => String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max);

async function allPages() {
  const { data } = await supabaseAdmin.from("site_pages").select(COLS).order("position", { ascending: true });
  return (data || []) as any[];
}

// A free address inside a group of sibling pages: "news", then "news-2", "news-3"...
function freeSlug(base: string, siblings: any[], ignoreId?: string) {
  const taken = new Set(siblings.filter((p) => p.id !== ignoreId).map((p) => p.slug));
  let slug = base || "page";
  let n = 2;
  while (taken.has(slug)) slug = `${base || "page"}-${n++}`;
  return slug;
}

const hrefOf = (page: any, pages: any[]) => {
  if (page.is_home) return "/";
  const parent = page.parent_id ? pages.find((p) => p.id === page.parent_id) : null;
  return parent ? `/${parent.slug}/${page.slug}` : `/${page.slug}`;
};

// GET -> every page (for the pages and menu manager)
export async function GET(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const pages = await allPages();
  return NextResponse.json({ pages: pages.map((p) => ({ ...p, href: hrefOf(p, pages) })), can_manage: auth.access.canPublish });
}

// POST -> a new page (blank, or a copy of another page). It stays unpublished until someone presses Publish.
export async function POST(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;
  const body = await request.json();

  const title = clean(body.title, 150);
  if (title.length < 2) return NextResponse.json({ error: "Please give the page a name." }, { status: 400 });

  const pages = await allPages();
  const parentId: string | null = body.parent_id ? String(body.parent_id) : null;
  if (parentId) {
    const parent = pages.find((p) => p.id === parentId);
    if (!parent) return NextResponse.json({ error: "That menu item wasn't found." }, { status: 400 });
    if (parent.parent_id || parent.is_home) return NextResponse.json({ error: "A sub-tab can only go under a main menu page (not the Home page, and not another sub-tab)." }, { status: 400 });
  }
  const siblings = pages.filter((p) => (p.parent_id || null) === parentId);
  let baseSlug = slugify(clean(body.slug, 80) || title);
  if (!parentId && (RESERVED_SLUGS.includes(baseSlug) || baseSlug === "home")) baseSlug = `${baseSlug}-page`;
  const slug = freeSlug(baseSlug, siblings);

  let sections: any[] = [];
  if (body.copy_from) {
    const { data: src } = await supabaseAdmin.from("site_pages").select("draft").eq("id", String(body.copy_from)).maybeSingle();
    if (src && Array.isArray(src.draft)) sections = JSON.parse(JSON.stringify(src.draft)).map((s: any) => ({ ...s, id: Math.random().toString(36).slice(2, 12) }));
  }
  if (sections.length === 0) {
    const banner: any = newSection("banner");
    banner.title = title;
    banner.subtitle = "";
    banner.kicker = "";
    sections = [banner, newSection("text")];
  }

  const position = siblings.reduce((m, p) => Math.max(m, Number(p.position) || 0), 0) + 1;
  const { data, error } = await supabaseAdmin
    .from("site_pages")
    .insert({
      slug,
      parent_id: parentId,
      title,
      menu_label: title.slice(0, 40),
      position,
      show_in_menu: body.show_in_menu !== false,
      is_home: false,
      draft: sections,
      published: [],
      has_unpublished: true,
      published_at: null,
      updated_by: auth.userId,
    })
    .select(COLS)
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not create the page." }, { status: 400 });

  await logAudit(auth.userId, "website", `Added the website page "${title}"${parentId ? " as a sub-tab" : ""}`, { page_id: data.id });
  return NextResponse.json({ success: true, page: { ...data, href: hrefOf(data, [...pages, data]) } });
}

// PATCH -> rename, change the web address, hide from the menu, or move under another page
export async function PATCH(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const pages = await allPages();
  const page = pages.find((p) => p.id === String(body.id || ""));
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });

  const patch: any = { updated_at: new Date().toISOString(), updated_by: auth.userId };
  if (typeof body.title === "string") {
    const t = clean(body.title, 150);
    if (t.length < 2) return NextResponse.json({ error: "The page name is too short." }, { status: 400 });
    patch.title = t;
  }
  if (typeof body.menu_label === "string") patch.menu_label = clean(body.menu_label, 40) || null;

  if (!page.is_home) {
    if (typeof body.show_in_menu === "boolean") patch.show_in_menu = body.show_in_menu;

    let targetParent: string | null = page.parent_id || null;
    if ("parent_id" in body) {
      const wanted: string | null = body.parent_id ? String(body.parent_id) : null;
      if (wanted !== targetParent) {
        if (wanted) {
          const parent = pages.find((p) => p.id === wanted);
          if (!parent || parent.id === page.id) return NextResponse.json({ error: "That menu item wasn't found." }, { status: 400 });
          if (parent.parent_id || parent.is_home) return NextResponse.json({ error: "A sub-tab can only go under a main menu page." }, { status: 400 });
          if (pages.some((p) => p.parent_id === page.id)) return NextResponse.json({ error: "This page has its own sub-tabs. Move those out first." }, { status: 400 });
        }
        targetParent = wanted;
        patch.parent_id = wanted;
        const group = pages.filter((p) => (p.parent_id || null) === wanted && p.id !== page.id);
        patch.position = group.reduce((m, p) => Math.max(m, Number(p.position) || 0), 0) + 1;
      }
    }

    if (typeof body.slug === "string" || patch.parent_id !== undefined) {
      let base = slugify(typeof body.slug === "string" ? body.slug : page.slug) || "page";
      if (!targetParent && (RESERVED_SLUGS.includes(base) || base === "home")) {
        return NextResponse.json({ error: `"${base}" is used by the portal. Please choose another web address.` }, { status: 400 });
      }
      const group = pages.filter((p) => (p.parent_id || null) === targetParent);
      const taken = group.some((p) => p.id !== page.id && p.slug === base);
      if (taken) {
        if (typeof body.slug === "string") return NextResponse.json({ error: `Another page here already uses the address "${base}".` }, { status: 400 });
        base = freeSlug(base, group, page.id);
      }
      patch.slug = base;
    }
  }

  const { data, error } = await supabaseAdmin.from("site_pages").update(patch).eq("id", page.id).select(COLS).single();
  if (error || !data) return NextResponse.json({ error: error?.message || "Could not save the changes." }, { status: 400 });
  await logAudit(auth.userId, "website", `Changed the settings of the website page "${data.title}"`, { page_id: page.id });
  return NextResponse.json({ success: true, page: data });
}

// DELETE -> remove a page (and any sub-tabs under it). The Home page can't be removed.
export async function DELETE(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;
  const { id } = await request.json();
  const pages = await allPages();
  const page = pages.find((p) => p.id === String(id || ""));
  if (!page) return NextResponse.json({ error: "Page not found." }, { status: 404 });
  if (page.is_home) return NextResponse.json({ error: "The Home page can't be deleted." }, { status: 400 });
  const kids = pages.filter((p) => p.parent_id === page.id);
  if (kids.length) await supabaseAdmin.from("site_pages").delete().eq("parent_id", page.id);
  const { error } = await supabaseAdmin.from("site_pages").delete().eq("id", page.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(auth.userId, "website", `Deleted the website page "${page.title}"${kids.length ? ` and ${kids.length} sub-tab(s)` : ""}`);
  return NextResponse.json({ success: true, removed: 1 + kids.length });
}
