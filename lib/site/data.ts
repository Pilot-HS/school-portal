import { supabaseAdmin } from "@/lib/roleAuth";
import type { MenuItem, PageRow, Section, SiteSettings } from "./types";
import { DEFAULT_SETTINGS } from "./defaults";

export type SiteState = {
  ready: boolean;
  reason?: "tables" | "empty";
  settings: SiteSettings;
  pages: PageRow[];
  menu: MenuItem[];
};

const missingTable = (e: any) => /(does not exist|schema cache)/i.test(String(e?.message || "")) && /site_/.test(String(e?.message || ""));

export function pageHref(page: PageRow, pages: PageRow[]): string {
  if (page.is_home) return "/";
  const parent = page.parent_id ? pages.find((p) => p.id === page.parent_id) : null;
  return parent ? `/${parent.slug}/${page.slug}` : `/${page.slug}`;
}

export async function loadSiteState(): Promise<SiteState> {
  const empty: SiteState = { ready: false, settings: DEFAULT_SETTINGS, pages: [], menu: [] };
  try {
    const [pagesRes, settingsRes] = await Promise.all([
      supabaseAdmin
        .from("site_pages")
        .select("id, slug, parent_id, title, menu_label, position, show_in_menu, is_home, seo_description")
        .order("position", { ascending: true }),
      supabaseAdmin.from("site_settings").select("key, published"),
    ]);
    if (pagesRes.error) return { ...empty, reason: missingTable(pagesRes.error) ? "tables" : "tables" };
    const pages = (pagesRes.data || []) as PageRow[];
    if (pages.length === 0) return { ...empty, reason: "empty" };

    const settings: SiteSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    (settingsRes.data || []).forEach((r: any) => {
      if (r.key === "general" && r.published) settings.general = { ...settings.general, ...r.published };
      if (r.key === "footer" && r.published) settings.footer = { ...settings.footer, ...r.published };
    });

    const toItem = (p: PageRow): MenuItem => ({
      id: p.id,
      label: p.menu_label || p.title,
      href: pageHref(p, pages),
      children: pages.filter((c) => c.parent_id === p.id && c.show_in_menu).map(toItem),
    });
    const menu = pages.filter((p) => !p.parent_id && p.show_in_menu).map(toItem);
    return { ready: true, settings, pages, menu };
  } catch {
    return { ...empty, reason: "tables" };
  }
}

export function resolvePage(pages: PageRow[], parts: string[]): PageRow | null {
  if (parts.length === 0) return pages.find((p) => p.is_home) || null;
  if (parts.length === 1) return pages.find((p) => !p.parent_id && p.slug === parts[0] && !p.is_home) || null;
  if (parts.length === 2) {
    const parent = pages.find((p) => !p.parent_id && p.slug === parts[0]);
    return parent ? pages.find((p) => p.parent_id === parent.id && p.slug === parts[1]) || null : null;
  }
  return null;
}

export async function loadPublishedSections(pageId: string): Promise<Section[]> {
  const { data } = await supabaseAdmin.from("site_pages").select("published").eq("id", pageId).maybeSingle();
  return Array.isArray(data?.published) ? (data!.published as Section[]) : [];
}
