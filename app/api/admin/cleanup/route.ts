import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";
import { fetchAllRows } from "@/lib/fetchAll";
import { logAudit } from "@/lib/audit";

export const maxDuration = 60;

// The sample records that came with the original presentation script.
const DEMO_STUDENTS = ["ali raza", "bilal shar", "hassan memon", "kashif solangi", "nasir chandio", "waseem bhatti", "iqbal rind", "sajjad lashari", "fahad khoso", "ahmed nawaz", "imran jokhio", "zubair panhwar", "farooq dahri", "junaid mahar", "saqib bhutto"];
const DEMO_TEACHERS = ["omar sheikh", "zainab hussain", "mehreen qureshi", "hamza tariq"];
const DEMO_NOTICES = ["term 1 parent-teacher meeting on 10 october", "sports day trials begin next week", "staff meeting thursday 3 pm"];
const DEMO_ASSIGNMENT_TITLES = ["chapter review exercise"];

const low = (s: unknown) => String(s ?? "").trim().toLowerCase();
const chunks = <T,>(a: T[], n = 50): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
};
async function count(table: string): Promise<number | null> {
  try {
    const { count: c, error } = await supabaseAdmin.from(table).select("*", { count: "exact", head: true });
    return error ? null : c || 0;
  } catch {
    return null;
  }
}

// GET -> everything that could be removed, with the sample records pre-marked
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [classes, students, teachers, notices, assignments, exams] = await Promise.all([
      supabaseAdmin.from("classes").select("id, grade, section"),
      fetchAllRows((a, b) => supabaseAdmin.from("students").select("id, full_name, roll_no, class_id, profile_id, parent_profile_id").range(a, b)),
      supabaseAdmin.from("teachers").select("id, full_name, subject, profile_id"),
      supabaseAdmin.from("notices").select("id, title, created_at"),
      supabaseAdmin.from("assignments").select("id, title, subject, class_id"),
      supabaseAdmin.from("exams").select("id, name, term"),
    ]);
    const cls: Record<string, string> = {};
    (classes.data || []).forEach((c: any) => (cls[String(c.id)] = `${c.grade}-${c.section}`));

    const profileIds = Array.from(new Set((teachers.data || []).map((t: any) => t.profile_id).filter(Boolean)));
    const roles: Record<string, string> = {};
    if (profileIds.length) {
      const { data: pr } = await supabaseAdmin.from("profiles").select("id, role").in("id", profileIds);
      (pr || []).forEach((p: any) => (roles[p.id] = p.role));
    }

    const [mcqQ, mcqP, audit, holidays, cover] = await Promise.all([count("mcq_questions"), count("mcq_papers"), count("audit_log"), count("school_holidays"), count("teacher_cover")]);

    return NextResponse.json({
      students: students.map((s: any) => ({ id: s.id, name: s.full_name, roll_no: s.roll_no, class_name: cls[String(s.class_id)] || "—", has_login: !!(s.profile_id || s.parent_profile_id), demo: DEMO_STUDENTS.includes(low(s.full_name)) })),
      teachers: (teachers.data || []).map((t: any) => ({ id: t.id, name: t.full_name, subject: t.subject, has_login: !!t.profile_id, protected: roles[t.profile_id] === "admin", demo: DEMO_TEACHERS.includes(low(t.full_name)) })),
      notices: (notices.data || []).map((n: any) => ({ id: n.id, title: n.title, demo: DEMO_NOTICES.includes(low(n.title)) })),
      assignments: (assignments.data || []).map((a: any) => ({ id: a.id, title: a.title, subject: a.subject, class_name: cls[String(a.class_id)] || "—", demo: DEMO_ASSIGNMENT_TITLES.includes(low(a.title)) })),
      exams: (exams.data || []).map((e: any) => ({ id: e.id, name: e.name, term: e.term })),
      counts: { mcq_questions: mcqQ, mcq_papers: mcqP, audit_log: audit, holidays, cover },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not look at the data." }, { status: 500 });
  }
}

// POST -> removes exactly what was chosen. Admin accounts are never touched.
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);
  const studentIds = arr(body.student_ids);
  const teacherIds = arr(body.teacher_ids);
  const noticeIds = arr(body.notice_ids);
  const assignmentIds = arr(body.assignment_ids);
  const examIds = arr(body.exam_ids);
  const deleteLogins = body.delete_logins === true;
  const clear = body.clear || {};

  const done: Record<string, number> = {};
  const problems: string[] = [];
  const run = async (label: string, fn: () => Promise<any>) => {
    try {
      const r = await fn();
      if (r && r.error) problems.push(`${label}: ${r.error.message}`);
    } catch (e: any) {
      problems.push(`${label}: ${e?.message || "failed"}`);
    }
  };
  const loginsToCheck = new Set<string>();

  // ---- Students and everything that belongs to them ----
  if (studentIds.length) {
    const { data: rows } = await supabaseAdmin.from("students").select("id, profile_id, parent_profile_id").in("id", studentIds.slice(0, 2000));
    (rows || []).forEach((s: any) => {
      if (s.profile_id) loginsToCheck.add(s.profile_id);
      if (s.parent_profile_id) loginsToCheck.add(s.parent_profile_id);
    });
    for (const part of chunks(studentIds)) {
      for (const table of ["attendance", "exam_results", "fees", "student_history"]) {
        await run(`${table} of students`, async () => supabaseAdmin.from(table).delete().in("student_id", part));
      }
      await run("students", async () => supabaseAdmin.from("students").delete().in("id", part));
    }
    done.students = studentIds.length;
  }

  // ---- Teachers (never one whose login is an admin) ----
  if (teacherIds.length) {
    const { data: trows } = await supabaseAdmin.from("teachers").select("id, profile_id").in("id", teacherIds.slice(0, 500));
    const pids = (trows || []).map((t: any) => t.profile_id).filter(Boolean);
    const roles: Record<string, string> = {};
    if (pids.length) {
      const { data: pr } = await supabaseAdmin.from("profiles").select("id, role").in("id", pids);
      (pr || []).forEach((p: any) => (roles[p.id] = p.role));
    }
    const allowed = (trows || []).filter((t: any) => roles[t.profile_id] !== "admin");
    const ids = allowed.map((t: any) => t.id);
    for (const part of chunks(ids)) {
      await run("attendance marker", async () => supabaseAdmin.from("attendance").update({ marked_by: null }).in("marked_by", part));
      await run("timetable", async () => supabaseAdmin.from("timetable_entries").delete().in("teacher_id", part));
      await run("assignments of teachers", async () => supabaseAdmin.from("assignments").delete().in("created_by", part));
      await run("leave requests", async () => supabaseAdmin.from("leave_requests").delete().in("teacher_id", part));
      try {
        await supabaseAdmin.from("teacher_cover").delete().in("teacher_id", part); // table may not exist yet
      } catch {
        /* ignore */
      }
      await run("teachers", async () => supabaseAdmin.from("teachers").delete().in("id", part));
    }
    allowed.forEach((t: any) => t.profile_id && roles[t.profile_id] === "teacher" && loginsToCheck.add(t.profile_id));
    done.teachers = ids.length;
    if (allowed.length < (trows || []).length) problems.push("A teacher record that belongs to an admin login was kept on purpose.");
  }

  // ---- Notices, homework, tests ----
  if (noticeIds.length) {
    for (const part of chunks(noticeIds)) await run("notices", async () => supabaseAdmin.from("notices").delete().in("id", part));
    done.notices = noticeIds.length;
  }
  if (assignmentIds.length) {
    for (const part of chunks(assignmentIds)) await run("assignments", async () => supabaseAdmin.from("assignments").delete().in("id", part));
    done.assignments = assignmentIds.length;
  }
  if (examIds.length) {
    for (const part of chunks(examIds)) {
      await run("exam marks", async () => supabaseAdmin.from("exam_results").delete().in("exam_id", part));
      await run("exam subjects", async () => supabaseAdmin.from("exam_subjects").delete().in("exam_id", part));
      await run("exams", async () => supabaseAdmin.from("exams").delete().in("id", part));
    }
    done.exams = examIds.length;
  }

  // ---- Optional clear-outs ----
  const wipe = async (table: string) => {
    try {
      const { error } = await supabaseAdmin.from(table).delete().not("id", "is", null);
      if (error && !/(does not exist|schema cache)/i.test(error.message)) problems.push(`${table}: ${error.message}`);
    } catch {
      /* ignore */
    }
  };
  if (clear.mcq) {
    await wipe("mcq_questions");
    await wipe("mcq_papers");
  }
  if (clear.holidays) await wipe("school_holidays");
  if (clear.cover) await wipe("teacher_cover");

  // ---- Logins that belonged only to what was removed (never admins) ----
  if (deleteLogins && loginsToCheck.size) {
    let removed = 0;
    for (const pid of Array.from(loginsToCheck)) {
      const { data: prof } = await supabaseAdmin.from("profiles").select("id, role").eq("id", pid).maybeSingle();
      if (!prof || !["student", "parent", "teacher"].includes(prof.role) || pid === auth.userId) continue;
      // keep a parent login that still has other children
      const { count: stillUsed } = await supabaseAdmin.from("students").select("id", { count: "exact", head: true }).or(`profile_id.eq.${pid},parent_profile_id.eq.${pid}`);
      const { count: teacherUsed } = await supabaseAdmin.from("teachers").select("id", { count: "exact", head: true }).eq("profile_id", pid);
      if ((stillUsed || 0) > 0 || (teacherUsed || 0) > 0) continue;
      try {
        await supabaseAdmin.from("site_editors").delete().eq("user_id", pid);
      } catch {
        /* ignore */
      }
      await run("login profile", async () => supabaseAdmin.from("profiles").delete().eq("id", pid));
      await run("login account", async () => supabaseAdmin.auth.admin.deleteUser(pid));
      removed++;
    }
    done.logins = removed;
  }

  if (clear.audit) await wipe("audit_log");
  else await logAudit(auth.userId, "setup", `Removed test data: ${Object.entries(done).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing"}`);

  return NextResponse.json({ success: true, done, problems });
}
