import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { randomInt } from "crypto";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { fetchAllRows } from "@/lib/fetchAll";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alike letters (l, i, o, 0, 1)
const MAX_PER_CALL = 60;

const password = () => Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
const slug = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

type Candidate = { id: string; name: string; label: string; roll: string; email: string; fullName: string };

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const kind: string = body.kind;
  const classId: string | null = body.class_id ? String(body.class_id) : null;
  const dryRun = body.dry_run === true;
  if (!["student", "parent", "teacher"].includes(kind)) {
    return NextResponse.json({ error: "Choose student, parent or teacher logins." }, { status: 400 });
  }

  // ---- Who still needs a login? ----
  let candidates: Candidate[] = [];
  try {
    if (kind === "teacher") {
      const rows = await fetchAllRows((from, to) =>
        supabaseAdmin.from("teachers").select("id, full_name, employee_number, is_active").is("profile_id", null).range(from, to)
      );
      candidates = rows
        .filter((t: any) => t.is_active !== false)
        .map((t: any) => ({
          id: t.id,
          name: t.full_name,
          label: t.employee_number ? `Emp. ${t.employee_number}` : "Staff",
          roll: "",
          fullName: t.full_name,
          email: t.employee_number
            ? `emp${slug(t.employee_number)}@staff.gbhspilotdadu.local`
            : `${slug(t.full_name).slice(0, 14) || "staff"}${String(t.id).replace(/-/g, "").slice(0, 4)}@staff.gbhspilotdadu.local`,
        }));
    } else {
      const column = kind === "student" ? "profile_id" : "parent_profile_id";
      const rows = await fetchAllRows((from, to) => {
        let q = supabaseAdmin
          .from("students")
          .select("id, full_name, roll_no, class_id, is_active, classes(name)")
          .is(column, null)
          .range(from, to);
        if (classId) q = q.eq("class_id", classId);
        return q;
      });
      candidates = rows
        .filter((s: any) => s.is_active !== false)
        .map((s: any) => {
          const cls = s.classes?.name || "";
          const stem = `${slug(cls) || "class"}-${slug(String(s.roll_no)) || String(s.id).slice(0, 4)}`;
          return {
            id: s.id,
            name: s.full_name,
            label: cls ? `Class ${cls}` : "No class",
            roll: String(s.roll_no ?? ""),
            fullName: kind === "parent" ? `Parent of ${s.full_name}` : s.full_name,
            email: `${stem}@${kind === "student" ? "student" : "parent"}.gbhspilotdadu.local`,
          };
        });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not load the list." }, { status: 500 });
  }

  if (dryRun) return NextResponse.json({ pending: candidates.length });

  const batch = candidates.slice(0, Math.min(MAX_PER_CALL, Math.max(1, Number(body.limit) || MAX_PER_CALL)));
  const created: any[] = [];
  const failed: { name: string; label: string; error: string }[] = [];

  const makeOne = async (c: Candidate) => {
    const pw = password();
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({ email: c.email, password: pw, email_confirm: true });
    if (userError || !userData.user) {
      const exists = /already|registered|exists/i.test(userError?.message || "");
      failed.push({ name: c.name, label: c.label, error: exists ? `A login with ${c.email} already exists. Link it by hand under Students or Teachers.` : userError?.message || "Could not create the login." });
      return;
    }
    const userId = userData.user.id;
    const undo = async () => {
      await supabaseAdmin.from("profiles").delete().eq("id", userId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
    };

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      full_name: c.fullName,
      role: kind,
    });
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      failed.push({ name: c.name, label: c.label, error: profileError.message });
      return;
    }

    const link =
      kind === "teacher"
        ? await supabaseAdmin.from("teachers").update({ profile_id: userId }).eq("id", c.id)
        : kind === "student"
        ? await supabaseAdmin.from("students").update({ profile_id: userId }).eq("id", c.id)
        : await supabaseAdmin.from("students").update({ parent_profile_id: userId }).eq("id", c.id);
    if (link.error) {
      await undo();
      failed.push({ name: c.name, label: c.label, error: link.error.message });
      return;
    }
    created.push({ name: c.fullName, student: c.name, label: c.label, roll: c.roll, role: kind, email: c.email, password: pw });
  };

  for (let i = 0; i < batch.length; i += 8) {
    await Promise.all(batch.slice(i, i + 8).map(makeOne));
  }

  // Anything that failed stays "pending", so don't count it as remaining work for this run
  if (created.length > 0) await logAudit(auth.userId, "logins", `Created ${created.length} ${kind} logins in bulk`, { failed: failed.length });
  const remaining = Math.max(0, candidates.length - batch.length);
  return NextResponse.json({ created, failed, remaining });
}
