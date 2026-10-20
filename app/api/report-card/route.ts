import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";
import { fetchAllRows } from "@/lib/fetchAll";
import { canAccessClass, noAccessResponse } from "@/lib/teacherAccess";

// Everything needed to print report cards: results, attendance and the grading scale.
// ?student_id=...  one student (student/parent: only their own)
// ?class_id=...    a whole class (teacher/admin)
export async function GET(request: Request) {
  const auth = await requireRole(request, ["student", "parent", "teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const p = new URL(request.url).searchParams;
  const studentId = p.get("student_id");
  const classId = p.get("class_id");
  const select = "id, full_name, roll_no, gr_number, house, class_id, profile_id, parent_profile_id, is_active, classes(name, grade, section)";

  let students: any[] = [];
  if (studentId) {
    const { data } = await supabaseAdmin.from("students").select(select).eq("id", studentId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    if (auth.role === "student" && data.profile_id !== auth.userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (auth.role === "parent" && data.parent_profile_id !== auth.userId) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (auth.role === "teacher" && !(await canAccessClass(auth, data.class_id))) return noAccessResponse();
    students = [data];
  } else if (classId) {
    if (auth.role === "student" || auth.role === "parent") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    if (!(await canAccessClass(auth, classId))) return noAccessResponse();
    const { data, error } = await supabaseAdmin.from("students").select(select).eq("class_id", classId).order("roll_no");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    students = (data || []).filter((s: any) => s.is_active !== false);
  } else {
    return NextResponse.json({ error: "Choose a student or a class." }, { status: 400 });
  }

  const ids = students.map((s) => s.id);
  let results: any[] = [];
  let attendance: any[] = [];
  if (ids.length > 0) {
    try {
      [results, attendance] = await Promise.all([
        fetchAllRows((from, to) =>
          supabaseAdmin.from("exam_results").select("student_id, exam_id, exam_name, term, subject, marks_obtained, total_marks").in("student_id", ids).range(from, to)
        ),
        fetchAllRows((from, to) => supabaseAdmin.from("attendance").select("student_id, status").in("student_id", ids).range(from, to)),
      ]);
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || "Could not load results." }, { status: 400 });
    }
  }

  const resultsBy: Record<string, any[]> = {};
  results.forEach((r) => (resultsBy[r.student_id] = resultsBy[r.student_id] || []).push(r));
  const attBy: Record<string, { present: number; absent: number; leave: number }> = {};
  attendance.forEach((a) => {
    const t = (attBy[a.student_id] = attBy[a.student_id] || { present: 0, absent: 0, leave: 0 });
    if (a.status === "present") t.present++;
    else if (a.status === "absent") t.absent++;
    else if (a.status === "leave") t.leave++;
  });

  const [scale, year] = await Promise.all([
    supabaseAdmin.from("grading_scales").select("id").eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("academic_years").select("label").eq("is_current", true).maybeSingle(),
  ]);
  let bands: any[] = [];
  if (scale.data) {
    const { data } = await supabaseAdmin
      .from("grade_bands")
      .select("grade_label, min_percentage, max_percentage, remarks")
      .eq("grading_scale_id", scale.data.id)
      .order("min_percentage", { ascending: false });
    bands = data || [];
  }

  return NextResponse.json({
    year_label: year.data?.label || "",
    bands,
    students: students.map((s) => ({
      id: s.id,
      full_name: s.full_name,
      roll_no: s.roll_no,
      gr_number: s.gr_number,
      house: s.house,
      class_name: s.classes?.name || [s.classes?.grade, s.classes?.section].filter(Boolean).join("-") || "",
      results: resultsBy[s.id] || [],
      attendance: attBy[s.id] || { present: 0, absent: 0, leave: 0 },
    })),
  });
}
