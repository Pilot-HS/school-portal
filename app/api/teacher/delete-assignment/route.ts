import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Assignment id is required" }, { status: 400 });
  }

  const { data: assignment } = await supabaseAdmin.from("assignments").select("id, created_by").eq("id", id).maybeSingle();
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  if (auth.role === "teacher") {
    const { data: teacherRow } = await supabaseAdmin.from("teachers").select("id").eq("profile_id", auth.userId).maybeSingle();
    if (!teacherRow || assignment.created_by !== teacherRow.id) {
      return NextResponse.json({ error: "You can only delete assignments you posted yourself." }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin.from("assignments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
