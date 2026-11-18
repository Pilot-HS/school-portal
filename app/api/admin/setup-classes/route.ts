import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";
import { logAudit } from "@/lib/audit";

const GRADES = ["6", "7", "8", "9", "10"]; // 10 = Matric
const SECTIONS = ["A", "B", "C", "D"];

// GET  -> which of the 20 classes (6 to 10, sections A to D) already exist
// POST -> creates the missing ones
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin.from("classes").select("grade, section");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const have = (data || []).map((c: any) => `${String(c.grade).trim()}-${String(c.section).trim().toUpperCase()}`);
  const grid = GRADES.map((g) => ({ grade: g, sections: SECTIONS.map((s) => ({ section: s, exists: have.includes(`${g}-${s}`) })) }));
  const other = (data || []).filter((c: any) => !(GRADES.includes(String(c.grade).trim()) && SECTIONS.includes(String(c.section).trim().toUpperCase())));
  return NextResponse.json({ grid, other_classes: other.map((c: any) => `${c.grade}-${c.section}`) });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await supabaseAdmin.from("classes").select("grade, section");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const have = new Set((data || []).map((c: any) => `${String(c.grade).trim()}-${String(c.section).trim().toUpperCase()}`));

  const missing: { grade: string; section: string }[] = [];
  GRADES.forEach((g) => SECTIONS.forEach((s) => !have.has(`${g}-${s}`) && missing.push({ grade: g, section: s })));
  if (missing.length === 0) return NextResponse.json({ success: true, created: 0 });

  const { error: insertError } = await supabaseAdmin.from("classes").insert(missing);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  await logAudit(auth.userId, "setup", `Created ${missing.length} classes (grades 6 to 10, sections A to D)`);
  return NextResponse.json({ success: true, created: missing.length });
}
