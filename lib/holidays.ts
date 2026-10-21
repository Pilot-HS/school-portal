import { supabaseAdmin } from "@/lib/roleAuth";
import type { Holiday } from "@/lib/attendanceStats";

// Holidays that apply to a class (school-wide ones plus that class's own) between two dates.
// If the holidays table doesn't exist yet, there simply are none.
export async function holidaysBetween(from: string, to: string, classId: string | null): Promise<Holiday[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("school_holidays")
      .select("holiday_date, reason, class_id")
      .gte("holiday_date", from)
      .lte("holiday_date", to);
    if (error) return [];
    return (data || [])
      .map((h: any) => ({ holiday_date: h.holiday_date, reason: h.reason, class_id: h.class_id ? String(h.class_id) : null }))
      .filter((h: Holiday) => h.class_id === null || classId === null || h.class_id === String(classId));
  } catch {
    return [];
  }
}

export async function holidayOn(date: string, classId: string): Promise<string | null> {
  const list = await holidaysBetween(date, date, classId);
  return list.length ? list[0].reason : null;
}
