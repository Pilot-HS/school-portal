import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

// The logged-in teacher's own leave requests.
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: teacherRow } = await supabaseAdmin.from("teachers").select("id").eq("profile_id", auth.userId).maybeSingle();
  if (!teacherRow) {
    return NextResponse.json({ requests: [] });
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select("*")
    .eq("teacher_id", teacherRow.id)
    .order("start_date", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ requests: data || [] });
}
