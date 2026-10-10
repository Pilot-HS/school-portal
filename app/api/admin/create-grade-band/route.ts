import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const { grade_label, min_percentage, max_percentage, remarks } = body;
  if (!grade_label || min_percentage === undefined || max_percentage === undefined) {
    return NextResponse.json({ error: "Grade label, minimum, and maximum percentage are required" }, { status: 400 });
  }
  if (Number(min_percentage) > Number(max_percentage)) {
    return NextResponse.json({ error: "Minimum percentage can't be greater than maximum percentage" }, { status: 400 });
  }
  const { data: activeScale } = await supabaseAdmin.from("grading_scales").select("id").eq("is_active", true).maybeSingle();
  if (!activeScale) {
    return NextResponse.json({ error: "No active grading scale found" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("grade_bands")
    .insert({
      grading_scale_id: activeScale.id,
      grade_label,
      min_percentage: Number(min_percentage),
      max_percentage: Number(max_percentage),
      remarks: remarks || null,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true, band: data });
}
