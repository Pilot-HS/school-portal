import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

function eachDate(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start);
  const last = new Date(end);
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { request_id, decision } = body; // decision: "approved" | "rejected"

  if (!request_id || !["approved", "rejected"].includes(decision)) {
    return NextResponse.json({ error: "request_id and a valid decision are required" }, { status: 400 });
  }

  const { data: leaveRequest } = await supabaseAdmin.from("leave_requests").select("*").eq("id", request_id).single();
  if (!leaveRequest) {
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("leave_requests")
    .update({ status: decision, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() })
    .eq("id", request_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (decision === "approved") {
    const dates = eachDate(leaveRequest.start_date, leaveRequest.end_date);
    for (const date of dates) {
      await supabaseAdmin
        .from("staff_attendance")
        .upsert(
          { teacher_id: leaveRequest.teacher_id, date, status: "leave", marked_by: auth.userId },
          { onConflict: "teacher_id,date" }
        );
    }
  }

  return NextResponse.json({ success: true });
}
