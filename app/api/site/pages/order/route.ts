import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../../_auth";
import { logAudit } from "@/lib/audit";

// POST {ids: [...]} -> put one group of sibling pages (all main pages, or the sub-tabs of one page) in this order
export async function POST(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (ids.length < 2 || ids.length > 200) return NextResponse.json({ error: "Nothing to reorder." }, { status: 400 });

  const { data } = await supabaseAdmin.from("site_pages").select("id, parent_id").in("id", ids);
  const rows = data || [];
  if (rows.length !== ids.length) return NextResponse.json({ error: "Some pages weren't found." }, { status: 400 });
  const groups = new Set(rows.map((r: any) => r.parent_id || "top"));
  if (groups.size !== 1) return NextResponse.json({ error: "Pages can only be reordered within the same menu level." }, { status: 400 });

  const results = await Promise.all(ids.map((id, i) => supabaseAdmin.from("site_pages").update({ position: i + 1 }).eq("id", id)));
  const failed = results.find((r) => r.error);
  if (failed && failed.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });
  await logAudit(auth.userId, "website", "Reordered the website menu");
  return NextResponse.json({ success: true });
}
