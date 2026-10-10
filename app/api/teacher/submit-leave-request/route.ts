import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roleAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { start_date, end_date, reason } = body;

  if (!start_date || !end_date) {
    return NextResponse.json({ error: "Start date and end date are required" }, { status: 400 });
  }

  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: "End date can't be before the start date" }, { status: 400 });
  }

  const { data: teacherRow } = await supabaseAdmin
    .from("teachers")
    .select("id")
    .eq("profile_id", auth.userId)
    .single();

  if (!teacherRow) {
    return NextResponse.json({ error: "No teacher record is linked to your account. Ask the admin to link it." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .insert({
      teacher_id: teacherRow.id,
      start_date,
      end_date,
      reason: reason || null,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, request: data });
}
