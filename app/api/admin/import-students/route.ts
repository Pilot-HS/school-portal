import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";

const MAX_ROWS = 500;
const HOUSES = ["Iqbal", "Jinnah", "Liaquat", "Fatima"];

type InputRow = {
  row: number;
  full_name?: string;
  roll_no?: string;
  class_name?: string;
  gr_number?: string;
  date_of_birth?: string;
  house?: string;
  academic_year?: string;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const text = (v: unknown) => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());
// Spreadsheet programs sometimes turn 12 into "12.0"
const cleanNumberish = (s: string) => (/^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, "") : s);

function parseDob(raw: string): { value: string | null } | { error: string } {
  const s = raw.trim();
  if (!s) return { value: null };

  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
    y = +match[1]; m = +match[2]; d = +match[3];
  } else if ((match = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s))) {
    d = +match[1]; m = +match[2]; y = +match[3]; // day first
  } else if (/^\d{4,6}(\.\d+)?$/.test(s) && Number(s) > 1000 && Number(s) < 80000) {
    // Excel stored a real date as a number
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  } else {
    return { error: `Date of birth "${s}" isn't a date I understand. Use day/month/year, like 05/03/2012.` };
  }

  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    return { error: `Date of birth "${s}" is not a real date.` };
  }
  const thisYear = new Date().getUTCFullYear();
  if (y < 1980 || y > thisYear || check.getTime() > Date.now()) {
    return { error: `Date of birth "${s}" looks wrong.` };
  }
  return { value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const dryRun = body.dry_run !== false; // anything other than an explicit false is only a preview
  const rawRows: InputRow[] = Array.isArray(body.rows) ? body.rows : [];

  const rows = rawRows
    .map((r) => ({
      row: Number(r.row) || 0,
      full_name: text(r.full_name),
      roll_no: cleanNumberish(text(r.roll_no)),
      class_name: text(r.class_name),
      gr_number: cleanNumberish(text(r.gr_number)),
      date_of_birth: text(r.date_of_birth),
      house: text(r.house),
      academic_year: text(r.academic_year),
    }))
    .filter((r) => r.full_name || r.roll_no || r.class_name || r.gr_number || r.date_of_birth || r.house || r.academic_year);

  if (rows.length === 0) {
    return NextResponse.json({ error: "The file has no student rows." }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Please import at most ${MAX_ROWS} students at a time. This file has ${rows.length}.` }, { status: 400 });
  }

  // ---- Reference data ----
  const [classesRes, yearsRes] = await Promise.all([
    supabaseAdmin.from("classes").select("id, name, grade, section"),
    supabaseAdmin.from("academic_years").select("id, label, is_current"),
  ]);
  if (classesRes.error || yearsRes.error) {
    return NextResponse.json({ error: "Could not load classes. Please try again." }, { status: 500 });
  }

  const classKeys = new Map<string, Set<string>>();
  (classesRes.data || []).forEach((c: any) => {
    const keys = [c.name, `${c.grade ?? ""}${c.section ?? ""}`].map((k) => norm(String(k || ""))).filter(Boolean);
    keys.forEach((k) => {
      if (!classKeys.has(k)) classKeys.set(k, new Set());
      classKeys.get(k)!.add(c.id);
    });
  });
  const years = yearsRes.data || [];
  const currentYear = years.find((y: any) => y.is_current);

  let existing: any[] = [];
  try {
    existing = await fetchAllRows((from, to) =>
      supabaseAdmin.from("students").select("class_id, roll_no, gr_number").range(from, to)
    );
  } catch {
    return NextResponse.json({ error: "Could not check existing students. Please try again." }, { status: 500 });
  }
  const takenRolls = new Set(existing.map((s) => `${s.class_id}|${String(s.roll_no).toLowerCase()}`));
  const takenGr = new Set(existing.filter((s) => s.gr_number).map((s) => String(s.gr_number).toLowerCase()));

  // ---- Check every row ----
  type Result = { row: number; name: string; roll_no: string; class_name: string; status: "ok" | "error"; message?: string };
  const results: Result[] = [];
  const toInsert: { index: number; record: any }[] = [];

  rows.forEach((r) => {
    const base = { row: r.row, name: r.full_name, roll_no: r.roll_no, class_name: r.class_name };
    const fail = (message: string) => results.push({ ...base, status: "error", message });

    if (r.full_name.length < 2) return fail("Full name is missing.");
    if (r.full_name.length > 150) return fail("Full name is too long.");
    if (!r.roll_no) return fail("Roll number is missing.");
    if (!r.class_name) return fail("Class is missing.");

    const ids = classKeys.get(norm(r.class_name));
    if (!ids || ids.size === 0) return fail(`Class "${r.class_name}" was not found. Spell it exactly as under Classes.`);
    if (ids.size > 1) return fail(`Class "${r.class_name}" matches more than one class. Ask the admin to rename one.`);
    const classId = Array.from(ids)[0];

    const rollKey = `${classId}|${r.roll_no.toLowerCase()}`;
    if (takenRolls.has(rollKey)) return fail(`Roll number ${r.roll_no} is already used in class ${r.class_name}.`);

    if (r.gr_number && takenGr.has(r.gr_number.toLowerCase())) return fail(`GR number ${r.gr_number} is already assigned to another student.`);

    const dob = parseDob(r.date_of_birth);
    if ("error" in dob) return fail(dob.error);

    let house: string | null = null;
    if (r.house) {
      house = HOUSES.find((h) => h.toLowerCase() === r.house.toLowerCase()) || null;
      if (!house) return fail(`House "${r.house}" is not valid. Use Iqbal, Jinnah, Liaquat or Fatima.`);
    }

    let yearId: string | null = currentYear?.id || null;
    if (r.academic_year) {
      const y = years.find((yy: any) => norm(yy.label) === norm(r.academic_year));
      if (!y) return fail(`Academic year "${r.academic_year}" was not found.`);
      yearId = y.id;
    }

    // Reserve this roll/GR so a repeat later in the same file is caught
    takenRolls.add(rollKey);
    if (r.gr_number) takenGr.add(r.gr_number.toLowerCase());

    results.push({ ...base, status: "ok" });
    toInsert.push({
      index: results.length - 1,
      record: {
        full_name: r.full_name,
        roll_no: r.roll_no,
        class_id: classId,
        academic_year_id: yearId,
        gr_number: r.gr_number || null,
        date_of_birth: dob.value,
        house,
      },
    });
  });

  const okCount = toInsert.length;
  if (dryRun) {
    return NextResponse.json({
      dry_run: true,
      summary: { total: results.length, ok: okCount, errors: results.length - okCount, imported: 0 },
      results,
    });
  }

  // ---- Save the good rows ----
  let imported = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { data, error } = await supabaseAdmin
      .from("students")
      .insert(chunk.map((c) => c.record))
      .select("id");

    if (error || !data) {
      chunk.forEach((c) => {
        results[c.index] = { ...results[c.index], status: "error", message: error?.message || "Could not be saved." };
      });
      continue;
    }
    imported += data.length;
    await supabaseAdmin.from("student_history").insert(
      data.map((d: any) => ({ student_id: d.id, event_type: "created", details: "Added by spreadsheet import" }))
    );
  }

  await logAudit(auth.userId, "imports", `Imported ${imported} students from a file`, { total: results.length, errors: results.filter((r) => r.status === "error").length });

  return NextResponse.json({
    dry_run: false,
    summary: { total: results.length, ok: okCount, errors: results.filter((r) => r.status === "error").length, imported },
    results,
  });
}
