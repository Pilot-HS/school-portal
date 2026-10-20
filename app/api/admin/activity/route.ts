import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  let query = supabaseAdmin.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
  if (p.get("action")) query = query.eq("action", p.get("action")!);
  const q = (p.get("q") || "").replace(/[%_,()]/g, " ").trim();
  if (q) query = query.ilike("summary", `%${q}%`);

  const { data, error } = await query;
  if (error) {
    if (/audit_log/.test(error.message) && /(does not exist|schema cache)/i.test(error.message)) {
      return NextResponse.json({ error: "The activity log table has not been created yet.", setup_needed: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const ids = Array.from(new Set((data || []).map((r: any) => r.user_id).filter(Boolean)));
  const names: Record<string, { name: string; role: string }> = {};
  if (ids.length > 0) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, role").in("id", ids);
    (profiles || []).forEach((pr: any) => {
      names[pr.id] = { name: pr.full_name, role: pr.role };
    });
  }

  return NextResponse.json({
    entries: (data || []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      action: r.action,
      summary: r.summary,
      details: r.details,
      who: r.user_id ? names[r.user_id]?.name || "Unknown user" : "System",
      role: r.user_id ? names[r.user_id]?.role || "" : "",
    })),
  });
}
