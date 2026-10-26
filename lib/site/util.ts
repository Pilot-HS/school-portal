import type { CSSProperties } from "react";

// Turns an inline style string ("border:1px solid red;") into a React style object.
export function styleObj(style?: string | null): CSSProperties | undefined {
  if (!style) return undefined;
  const out: Record<string, string> = {};
  style.split(";").forEach((decl) => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) return;
    const key = prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[key] = val;
  });
  return out as unknown as CSSProperties;
}

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

// These  words are used by the portal itself, so a website page can't take them.
export const RESERVED_SLUGS = ["login", "admin", "teacher", "student", "parent", "api", "forgot-password", "reset-password", "_next", "favicon.ico"];
