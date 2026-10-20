import { supabaseAdmin } from "@/lib/roleAuth";

// Writes one line to the activity log. Never stops the real action if logging fails
// (for example before the audit_log table has been created).
export async function logAudit(userId: string | null | undefined, action: string, summary: string, details?: unknown) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      user_id: userId || null,
      action,
      summary: summary.slice(0, 400),
      details: details === undefined ? null : details,
    });
  } catch {
    /* ignore */
  }
}
