import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";
import { logAudit } from "@/lib/audit";

// Moves students to a new class.
//   dry_run: true   -> only shows what would happen
//   renumber: true  -> a student whose roll number is taken in the new class gets the next free number
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { student_ids, new_class_id } = body;
  const dryRun = body.dry_run === true;
  const renumber = body.renumber === true;

  if (!Array.isArray(student_ids) || student_ids.length === 0 || !new_class_id) {
    return NextResponse.json({ error: "student_ids and new_class_id are required" }, { status: 400 });
  }

  const [{ data: destinationStudents }, { data: movingStudents }] = await Promise.all([
    supabaseAdmin.from("students").select("roll_no").eq("class_id", new_class_id),
    supabaseAdmin.from("students").select("id, full_name, roll_no").in("id", student_ids),
  ]);

  const taken = new Set((destinationStudents || []).map((s: any) => String(s.roll_no)));
  const moving = (movingStudents || []).slice().sort((a: any, b: any) => String(a.roll_no).localeCompare(String(b.roll_no), undefined, { numeric: true }));

  let maxNumeric = 0;
  [...(destinationStudents || []), ...moving].forEach((s: any) => {
    const n = Number(s.roll_no);
    if (Number.isFinite(n) && n > maxNumeric) maxNumeric = n;
  });
  const nextFree = () => {
    let n = maxNumeric + 1;
    while (taken.has(String(n))) n++;
    maxNumeric = n;
    return String(n);
  };

  type Plan = { id: string; name: string; from_roll: string; to_roll: string; status: "same" | "renumbered" | "skipped"; reason?: string };
  const plan: Plan[] = moving.map((s: any) => {
    const from = String(s.roll_no);
    if (!taken.has(from)) {
      taken.add(from);
      return { id: s.id, name: s.full_name, from_roll: from, to_roll: from, status: "same" as const };
    }
    if (renumber) {
      const to = nextFree();
      taken.add(to);
      return { id: s.id, name: s.full_name, from_roll: from, to_roll: to, status: "renumbered" as const };
    }
    return { id: s.id, name: s.full_name, from_roll: from, to_roll: from, status: "skipped" as const, reason: `Roll number ${from} is already taken in the new class` };
  });

  if (dryRun) return NextResponse.json({ dry_run: true, plan });

  const promoted: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const item of plan) {
    if (item.status === "skipped") {
      skipped.push({ name: item.name, reason: item.reason || "Skipped" });
      continue;
    }
    const update: any = { class_id: new_class_id };
    if (item.status === "renumbered") update.roll_no = item.to_roll;
    const { error } = await supabaseAdmin.from("students").update(update).eq("id", item.id);
    if (error) {
      skipped.push({ name: item.name, reason: error.message });
    } else {
      promoted.push(item.status === "renumbered" ? `${item.name} (new roll ${item.to_roll})` : item.name);
      await supabaseAdmin.from("student_history").insert({
        student_id: item.id,
        event_type: "class_change",
        details: item.status === "renumbered" ? `Promoted via bulk promotion (roll ${item.from_roll} → ${item.to_roll})` : "Promoted via bulk promotion",
      });
    }
  }

  await logAudit(auth.userId, "promotion", `Promoted ${promoted.length} students to a new class${skipped.length ? ` (${skipped.length} skipped)` : ""}`, { new_class_id });
  return NextResponse.json({ success: true, promoted, skipped });
}
