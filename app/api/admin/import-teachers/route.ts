import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";

const MAX_ROWS = 300;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim());
const cleanNumberish = (s: string) => (/^\d+\.0+$/.test(s) ? s.replace(/\.0+$/, "") : s);

function parseDate(raw: string, label: string, minYear: number): { value: string | null } | { error: string } {
  const s = raw.trim();
  if (!s) return { value: null };
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
    y = +match[1]; m = +match[2]; d = +match[3];
  } else if ((match = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/.exec(s))) {
    d = +match[1]; m = +match[2]; y = +match[3];
  } else if (/^\d{4,6}(\.\d+)?$/.test(s) && Number(s) > 1000 && Number(s) < 80000) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    y = dt.getUTCFullYear(); m = dt.getUTCMonth() + 1; d = dt.getUTCDate();
  } else {
    return { error: `${label} "${s}" isn't a date I understand. Use day/month/year, like 05/03/1985.` };
  }
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return { error: `${label} "${s}" is not a real date.` };
  if (y < minYear || check.getTime() > Date.now()) return { error: `${label} "${s}" looks wrong.` };
  return { value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const dryRun = body.dry_run !== false;
  const raw: any[] = Array.isArray(body.rows) ? body.rows : [];

  const rows = raw
    .map((r) => ({
      row: Number(r.row) || 0,
      full_name: text(r.full_name),
      employee_number: cleanNumberish(text(r.employee_number)),
      designation: text(r.designation),
      subject: text(r.subject),
      mobile_number: text(r.mobile_number),
      email: text(r.email),
      cnic: text(r.cnic),
      gender: text(r.gender),
      date_of_birth: text(r.date_of_birth),
      date_of_joining: text(r.date_of_joining),
    }))
    .filter((r) => Object.values(r).some((v, i) => i > 0 && v !== ""));

  if (rows.length === 0) return NextResponse.json({ error: "The file has no staff rows." }, { status: 400 });
  if (rows.length > MAX_ROWS) return NextResponse.json({ error: `Please import at most ${MAX_ROWS} staff at a time. This file has ${rows.length}.` }, { status: 400 });

  let existing: any[] = [];
  try {
    existing = await fetchAllRows((from, to) => supabaseAdmin.from("teachers").select("employee_number, cnic").range(from, to));
  } catch {
    return NextResponse.json({ error: "Could not check existing staff. Please try again." }, { status: 500 });
  }
  const takenEmp = new Set(existing.filter((t) => t.employee_number).map((t) => String(t.employee_number).toLowerCase()));
  const takenCnic = new Set(existing.filter((t) => t.cnic).map((t) => String(t.cnic).replace(/\D/g, "")));

  type Result = { row: number; name: string; employee_number: string; designation: string; status: "ok" | "error"; message?: string };
  const results: Result[] = [];
  const toInsert: { index: number; record: any }[] = [];

  rows.forEach((r) => {
    const base = { row: r.row, name: r.full_name, employee_number: r.employee_number, designation: r.designation };
    const fail = (message: string) => results.push({ ...base, status: "error", message });

    if (r.full_name.length < 2) return fail("Full name is missing.");
    if (r.full_name.length > 150) return fail("Full name is too long.");
    if (r.employee_number && takenEmp.has(r.employee_number.toLowerCase())) return fail(`Employee number ${r.employee_number} is already assigned to someone else.`);

    let cnic: string | null = null;
    if (r.cnic) {
      const digits = r.cnic.replace(/\D/g, "");
      if (digits.length !== 13) return fail(`CNIC "${r.cnic}" should have 13 digits.`);
      if (takenCnic.has(digits)) return fail(`CNIC ${r.cnic} is already used by another staff member.`);
      cnic = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
    }
    if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) return fail(`Email "${r.email}" doesn't look right.`);

    let gender: string | null = null;
    if (r.gender) {
      const g = r.gender.toLowerCase();
      gender = g.startsWith("m") ? "Male" : g.startsWith("f") ? "Female" : null;
      if (!gender) return fail(`Gender "${r.gender}" should be Male or Female.`);
    }

    const dob = parseDate(r.date_of_birth, "Date of birth", 1940);
    if ("error" in dob) return fail(dob.error);
    const doj = parseDate(r.date_of_joining, "Date of joining", 1970);
    if ("error" in doj) return fail(doj.error);

    if (r.employee_number) takenEmp.add(r.employee_number.toLowerCase());
    if (cnic) takenCnic.add(cnic.replace(/\D/g, ""));

    results.push({ ...base, status: "ok" });
    toInsert.push({
      index: results.length - 1,
      record: {
        full_name: r.full_name,
        employee_number: r.employee_number || null,
        designation: r.designation || null,
        subject: r.subject || null,
        qualification_subject: r.subject || null,
        mobile_number: r.mobile_number || null,
        email: r.email || null,
        cnic,
        gender,
        date_of_birth: dob.value,
        date_of_joining_school: doj.value,
        status: "Active",
        profile_id: null,
      },
    });
  });

  const okCount = toInsert.length;
  if (dryRun) {
    return NextResponse.json({ dry_run: true, summary: { total: results.length, ok: okCount, errors: results.length - okCount, imported: 0 }, results });
  }

  let imported = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const { data, error } = await supabaseAdmin.from("teachers").insert(chunk.map((c) => c.record)).select("id");
    if (error || !data) {
      chunk.forEach((c) => {
        results[c.index] = { ...results[c.index], status: "error", message: error?.message || "Could not be saved." };
      });
      continue;
    }
    imported += data.length;
  }

  return NextResponse.json({
    dry_run: false,
    summary: { total: results.length, ok: okCount, errors: results.filter((r) => r.status === "error").length, imported },
    results,
  });
}
