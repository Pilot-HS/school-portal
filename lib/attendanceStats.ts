// Shared attendance maths (used by the admin page, the register, parents' view and the server).

export type Status = "present" | "late" | "absent" | "leave";
export const STATUS_CODE: Record<string, string> = { present: "P", late: "Lt", absent: "A", leave: "Lv" };
export const STATUS_LABEL: Record<string, string> = { present: "Present", late: "Late", absent: "Absent", leave: "Leave" };

export type Holiday = { holiday_date: string; reason: string; class_id: string | null };
export type DayInfo = { date: string; kind: "working" | "sunday" | "holiday" | "future"; reason?: string };
export type Totals = { present: number; late: number; absent: number; leave: number; marked: number; notMarked: number; workingDays: number; pct: number | null };

export const isSunday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function datesBetween(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < max) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

// One entry per calendar day. Sundays and holidays are kept (and labelled), never dropped.
export function dayInfos(from: string, to: string, holidays: Holiday[], classId: string | null, today: string): DayInfo[] {
  return datesBetween(from, to).map((date) => {
    if (isSunday(date)) return { date, kind: "sunday" as const, reason: "Sunday" };
    const h = holidays.find((x) => x.holiday_date === date && (x.class_id === null || x.class_id === classId));
    if (h) return { date, kind: "holiday" as const, reason: h.reason };
    if (date > today) return { date, kind: "future" as const };
    return { date, kind: "working" as const };
  });
}

// Late counts as attended. Only working days are counted.
export function totalsFor(days: DayInfo[], rec: Record<string, string> | undefined): Totals {
  const t: Totals = { present: 0, late: 0, absent: 0, leave: 0, marked: 0, notMarked: 0, workingDays: 0, pct: null };
  days.forEach((d) => {
    if (d.kind !== "working") return;
    t.workingDays++;
    const s = rec?.[d.date];
    if (s === "present") t.present++;
    else if (s === "late") t.late++;
    else if (s === "absent") t.absent++;
    else if (s === "leave") t.leave++;
    else {
      t.notMarked++;
      return;
    }
    t.marked++;
  });
  t.pct = t.marked > 0 ? Math.round(((t.present + t.late) / t.marked) * 100) : null;
  return t;
}

// Absent on consecutive working days, counting back from the most recent marked day.
export function currentAbsentStreak(days: DayInfo[], rec: Record<string, string> | undefined): { count: number; since: string } {
  let count = 0;
  let since = "";
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i];
    if (d.kind !== "working") continue;
    const s = rec?.[d.date];
    if (!s) {
      if (count === 0) continue; // today may simply not be marked yet
      break;
    }
    if (s === "absent") {
      count++;
      since = d.date;
    } else break;
  }
  return { count, since };
}

export function monthChunks(days: DayInfo[]): { key: string; label: string; days: DayInfo[] }[] {
  const map = new Map<string, DayInfo[]>();
  days.forEach((d) => {
    const k = d.date.slice(0, 7);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(d);
  });
  return Array.from(map.entries()).map(([key, ds]) => ({
    key,
    label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }),
    days: ds,
  }));
}
