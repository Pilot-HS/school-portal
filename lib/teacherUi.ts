// Small helpers shared by the teacher pages.

export function classLabel(c: any): string {
  if (!c) return "—";
  return c.name || [c.grade, c.section].filter(Boolean).join("-") || "Class";
}

// Today's date as YYYY-MM-DD in the teacher's own time zone
// (toISOString() would use UTC and show yesterday early in the morning).
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
