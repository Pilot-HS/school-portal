import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";

// Today's date in Pakistan (UTC+5), as YYYY-MM-DD
export function todayInSchool(): string {
  return new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

// The classes a teacher may work with: the ones in their timetable,
// plus any classes the admin has given them as temporary (substitute) cover today.
export async function getAllowedClassIds(userId: string): Promise<{ teacherId: string | null; classIds: string[] }> {
  const { data: teacher } = await supabaseAdmin.from("teachers").select("id").eq("profile_id", userId).maybeSingle();
  if (!teacher) return { teacherId: null, classIds: [] };

  const today = todayInSchool();
  const [timetable, cover] = await Promise.all([
    supabaseAdmin.from("timetable_entries").select("class_id").eq("teacher_id", teacher.id),
    supabaseAdmin.from("teacher_cover").select("class_id").eq("teacher_id", teacher.id).lte("start_date", today).gte("end_date", today),
  ]);

  const ids = new Set<string>();
  (timetable.data || []).forEach((r: any) => r.class_id && ids.add(String(r.class_id)));
  // If the cover table doesn't exist yet, cover.error is set and we simply ignore it
  if (!cover.error) (cover.data || []).forEach((r: any) => r.class_id && ids.add(String(r.class_id)));
  return { teacherId: teacher.id, classIds: Array.from(ids) };
}

// Admins can use every class. Teachers only their own (see above).
export async function canAccessClass(auth: { userId: string; role: string }, classId: string | null | undefined): Promise<boolean> {
  if (auth.role !== "teacher") return true;
  if (!classId) return false;
  const { classIds } = await getAllowedClassIds(auth.userId);
  return classIds.includes(String(classId));
}

export const noAccessResponse = () =>
  NextResponse.json(
    { error: "You aren't assigned to this class. Ask the admin to add it to your timetable, or to set up substitute cover for you." },
    { status: 403 }
  );
