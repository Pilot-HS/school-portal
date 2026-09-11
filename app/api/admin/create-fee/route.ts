import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { student_id, charge_name, amount, status, due_date } = body;

  if (!student_id || !charge_name || !amount) {
    return NextResponse.json({ error: "Student, charge name, and amount are required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("fees")
    .insert({
      student_id,
      charge_name,
      amount,
      status: status || "unpaid",
      due_date: due_date || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, fee: data });
}
