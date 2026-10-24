import { sanitizeHtml } from "./sanitize";

// Checks and cleans whatever the editor sends before it is saved,
// so a page can never contain code or broken data.

export const SECTION_TYPES = ["banner", "hero", "quick_links", "split", "stats", "cards", "features", "facilities", "gallery", "cta", "newsletter", "html"];
const HTML_KEYS = new Set(["html", "text", "lead", "paragraphs"]);
const URL_KEYS = new Set(["href", "src"]);
const MAX_SECTIONS = 80;

export function cleanUrl(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 1000);
  if (!s) return "";
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return "#"; // javascript:, data:, etc.
  return s; // relative like "about" or "files/a.pdf"
}

function cleanString(key: string, v: string): string {
  if (URL_KEYS.has(key)) return cleanUrl(v);
  if (HTML_KEYS.has(key)) return sanitizeHtml(v).slice(0, 60000);
  // plain text: no markup, no control characters
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/<[^>]*>/g, "").slice(0, 2000);
}

function walk(value: any, key: string, depth: number): any {
  if (depth > 8) return null;
  if (typeof value === "string") return cleanString(key, value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((x) => walk(x, key, depth + 1));
  if (value && typeof value === "object") {
    const out: any = {};
    for (const k of Object.keys(value).slice(0, 40)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      out[k] = walk(value[k], k, depth + 1);
    }
    return out;
  }
  return null;
}

export function cleanSections(input: unknown): { ok: true; sections: any[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "The page content isn't in the right shape." };
  if (input.length > MAX_SECTIONS) return { ok: false, error: `A page can have at most ${MAX_SECTIONS} sections.` };
  const seen = new Set<string>();
  const out: any[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object" || !SECTION_TYPES.includes(raw.type)) return { ok: false, error: "One of the sections has an unknown type." };
    const cleaned = walk(raw, "", 0);
    let id = String(cleaned.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    if (!id || seen.has(id)) id = Math.random().toString(36).slice(2, 12);
    seen.add(id);
    cleaned.id = id;
    cleaned.hidden = raw.hidden === true;
    out.push(cleaned);
  }
  if (JSON.stringify(out).length > 900000) return { ok: false, error: "This page is too large to save." };
  return { ok: true, sections: out };
}

const str = (v: unknown, max: number) => String(v ?? "").replace(/<[^>]*>/g, "").trim().slice(0, max);
const links = (arr: any, max: number) =>
  (Array.isArray(arr) ? arr : []).slice(0, max).map((l) => ({ label: str(l?.label, 80), href: cleanUrl(l?.href) }));

export function cleanSettings(general: any, footer: any) {
  const g = general || {};
  const f = footer || {};
  return {
    general: {
      school_name: str(g.school_name, 150),
      tagline: str(g.tagline, 150),
      phone: str(g.phone, 60),
      email: str(g.email, 100),
      address_short: str(g.address_short, 150),
      apply_label: str(g.apply_label, 40),
      apply_href: cleanUrl(g.apply_href) || "/admissions",
      show_portal_link: g.show_portal_link !== false,
      brand_mark: str(g.brand_mark, 2),
    },
    footer: {
      about: str(f.about, 400),
      social: links(f.social, 8),
      columns: (Array.isArray(f.columns) ? f.columns : []).slice(0, 6).map((c: any) => ({ title: str(c?.title, 60), links: links(c?.links, 12) })),
      legal: links(f.legal, 8),
      copyright: str(f.copyright, 200),
    },
  };
}
