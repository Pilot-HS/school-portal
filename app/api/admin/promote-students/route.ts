import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { student_ids, new_class_id } = body;

  if (!Array.isArray(student_ids) || student_ids.length === 0 || !new_class_id) {
    return NextResponse.json({ error: "student_ids and new_class_id are required" }, { status: 400 });
  }

  const { data: destinationStudents } = await supabaseAdmin
    .from("students")
    .select("roll_no")
    .eq("class_id", new_class_id);
  const takenRollNumbers = new Set((destinationStudents || []).map((s) => s.roll_no));

  const { data: movingStudents } = await supabaseAdmin
    .from("students")
    .select("id, full_name, roll_no")
    .in("id", student_ids);

  const promoted: string[] = [];
  const skipped: { name: string; reason: string }[] = [];

  for (const student of movingStudents || []) {
    if (takenRollNumbers.has(student.roll_no)) {
      skipped.push({ name: student.full_name, reason: `Roll number ${student.roll_no} is already taken in the destination class` });
      continue;
    }
    const { error } = await supabaseAdmin.from("students").update({ class_id: new_class_id }).eq("id", student.id);
    if (error) {
      skipped.push({ name: student.full_name, reason: error.message });
    } else {
      promoted.push(student.full_name);
      takenRollNumbers.add(student.roll_no);
      await supabaseAdmin.from("student_history").insert({
        student_id: student.id,
        event_type: "class_change",
        details: "Promoted via bulk promotion",
      });
    }
  }

  return NextResponse.json({ success: true, promoted, skipped });
}
