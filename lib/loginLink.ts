import { supabaseAdmin } from "@/lib/admissionShared";

// Returns an error message if this login can't be linked to a teacher record, otherwise null.
export async function checkTeacherLoginLinkable(profileId: string, currentTeacherId: string | null): Promise<string | null> {
  const { data: profile } = await supabaseAdmin.from("profiles").select("role, full_name").eq("id", profileId).maybeSingle();
  if (!profile) return "That login was not found.";
  if (profile.role !== "teacher") return `${profile.full_name} has a ${profile.role} login, not a teacher login.`;

  let query = supabaseAdmin.from("teachers").select("id, full_name").eq("profile_id", profileId);
  if (currentTeacherId) query = query.neq("id", currentTeacherId);
  const { data: other } = await query.limit(1).maybeSingle();
  if (other) return `That login is already linked to ${other.full_name}.`;

  return null;
}
