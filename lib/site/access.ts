import { supabaseAdmin } from "@/lib/roleAuth";

export type SiteAccess = { canEdit: boolean; canPublish: boolean; via: "admin" | "editor" | "none"; expires_at?: string | null };

// Who may change the website: admins always; anyone else only if an admin has given them permission
// (optionally until a date, and optionally without the right to publish).
export async function getSiteAccess(userId: string, role: string): Promise<SiteAccess> {
  if (role === "admin") return { canEdit: true, canPublish: true, via: "admin" };
  try {
    const { data, error } = await supabaseAdmin.from("site_editors").select("can_publish, expires_at").eq("user_id", userId).maybeSingle();
    if (error || !data) return { canEdit: false, canPublish: false, via: "none" };
    if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return { canEdit: false, canPublish: false, via: "none" };
    return { canEdit: true, canPublish: !!data.can_publish, via: "editor", expires_at: data.expires_at };
  } catch {
    return { canEdit: false, canPublish: false, via: "none" };
  }
}
