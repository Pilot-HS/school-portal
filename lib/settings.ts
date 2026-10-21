import { supabaseAdmin } from "@/lib/roleAuth";

// Small school-wide settings (stored in the portal_settings table).
// If the table doesn't exist yet, the default is used.
export async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin.from("portal_settings").select("value").eq("key", key).maybeSingle();
    if (error || !data) return fallback;
    return String(data.value);
  } catch {
    return fallback;
  }
}

export async function getAttendanceSettings(): Promise<{ lockDays: number; lowThreshold: number }> {
  const [lock, low] = await Promise.all([getSetting("attendance_lock_days", "0"), getSetting("attendance_low_threshold", "70")]);
  const lockDays = Math.max(0, Math.min(365, parseInt(lock, 10) || 0));
  const lowThreshold = Math.max(1, Math.min(100, parseInt(low, 10) || 70));
  return { lockDays, lowThreshold };
}
