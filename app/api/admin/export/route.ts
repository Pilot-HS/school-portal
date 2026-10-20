import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";

export const maxDuration = 60;

const csvCell = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

function toCsv(rows: Record<string, unknown>[], preferred: string[] = []): string {
  const keys: string[] = [];
  preferred.forEach((k) => rows.some((r) => k in r) && keys.push(k));
  rows.forEach((r) => Object.keys(r).forEach((k) => !keys.includes(k) && keys.push(k)));
  if (keys.length === 0) return "\uFEFFNo data\r\n";
  return "\uFEFF" + [keys.map(csvCell).join(","), ...rows.map((r) => keys.map((k) => csvCell(r[k])).join(","))].join("\r\n") + "\r\n";
}

// Download a spreadsheet-ready copy of school data.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  const type = p.get("type") || "";
  const all = (table: string, build?: (q: any) => any) =>
    fetchAllRows((from, to) => {
      let q: any = supabaseAdmin.from(table).select("*");
      if (build) q = build(q);
      return q.range(from, to);
    });

  try {
    const [classesRes, studentsRes] = await Promise.all([
      supabaseAdmin.from("classes").select("id, name, grade, section"),
      type === "teachers" || type === "notices" ? Promise.resolve({ data: [] as any[] }) : all("students").then((d) => ({ data: d })),
    ]);
    const className: Record<string, string> = {};
    (classesRes.data || []).forEach((c: any) => {
      className[String(c.id)] = c.name || [c.grade, c.section].filter(Boolean).join("-");
    });
    const studentInfo: Record<string, { name: string; roll: string; cls: string }> = {};
    ((studentsRes as any).data || []).forEach((s: any) => {
      studentInfo[s.id] = { name: s.full_name, roll: String(s.roll_no ?? ""), cls: className[String(s.class_id)] || "" };
    });
    const strip = (r: any, drop: string[]) => {
      const o: any = { ...r };
      drop.forEach((k) => delete o[k]);
      return o;
    };

    let rows: Record<string, unknown>[] = [];
    let preferred: string[] = [];
    let filename = type;

    if (type === "students") {
      rows = ((studentsRes as any).data || []).map((s: any) => ({ ...strip(s, ["id", "profile_id", "parent_profile_id", "class_id", "academic_year_id"]), class: className[String(s.class_id)] || "" }));
      preferred = ["full_name", "class", "roll_no", "gr_number", "date_of_birth", "house"];
    } else if (type === "teachers") {
      rows = (await all("teachers")).map((t: any) => strip(t, ["id", "profile_id"]));
      preferred = ["full_name", "employee_number", "designation", "subject", "mobile_number", "email"];
    } else if (type === "attendance") {
      const from = p.get("from") || new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
      const to = p.get("to") || new Date().toISOString().slice(0, 10);
      const data = await all("attendance", (q) => q.gte("date", from).lte("date", to).order("date"));
      rows = data.map((a: any) => ({ date: a.date, class: studentInfo[a.student_id]?.cls || "", roll_no: studentInfo[a.student_id]?.roll || "", student: studentInfo[a.student_id]?.name || "", status: a.status }));
      filename = `attendance-${from}-to-${to}`;
    } else if (type === "results") {
      const data = await all("exam_results");
      rows = data.map((r: any) => ({
        exam: r.exam_name, term: r.term, class: studentInfo[r.student_id]?.cls || "", roll_no: studentInfo[r.student_id]?.roll || "",
        student: studentInfo[r.student_id]?.name || "", subject: r.subject, marks_obtained: r.marks_obtained, total_marks: r.total_marks,
      }));
    } else if (type === "assignments") {
      const data = await all("assignments");
      rows = data.map((a: any) => ({ class: className[String(a.class_id)] || "", subject: a.subject, title: a.title, due_date: a.due_date }));
    } else if (type === "notices") {
      rows = (await all("notices")).map((n: any) => ({ date: n.created_at, title: n.title, audience: n.audience, body: n.body }));
    } else if (type === "fees") {
      const data = await all("fees");
      rows = data.map((f: any) => ({ class: studentInfo[f.student_id]?.cls || "", roll_no: studentInfo[f.student_id]?.roll || "", student: studentInfo[f.student_id]?.name || "", charge: f.charge_name, amount: f.amount, status: f.status }));
    } else {
      return NextResponse.json({ error: "Unknown export type." }, { status: 400 });
    }

    return new NextResponse(toCsv(rows, preferred), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not create the file." }, { status: 500 });
  }
}
