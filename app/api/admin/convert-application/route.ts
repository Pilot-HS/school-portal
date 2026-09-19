import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const {
    application_id,
    student_full_name,
    roll_no,
    class_id,
    gr_number,
    create_parent_login,
    parent_email,
    parent_password,
  } = body;

  if (!application_id || !student_full_name || !roll_no || !class_id) {
    return NextResponse.json({ error: "Student name, roll number, and class are required" }, { status: 400 });
  }

  const { data: application } = await supabaseAdmin
    .from("admission_applications")
    .select("*")
    .eq("id", application_id)
    .single();

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (application.converted_student_id) {
    return NextResponse.json({ error: "This application has already been converted to a student record" }, { status: 400 });
  }

  // Prevent duplicate roll numbers in the same class
  const { data: existingRoll } = await supabaseAdmin
    .from("students")
    .select("id, full_name")
    .eq("class_id", class_id)
    .eq("roll_no", roll_no)
    .maybeSingle();
  if (existingRoll) {
    return NextResponse.json(
      { error: `Roll number ${roll_no} is already used by ${existingRoll.full_name} in this class.` },
      { status: 400 }
    );
  }

  if (gr_number) {
    const { data: existingGr } = await supabaseAdmin
      .from("students")
      .select("id, full_name")
      .eq("gr_number", gr_number)
      .maybeSingle();
    if (existingGr) {
      return NextResponse.json({ error: `GR number ${gr_number} is already assigned to ${existingGr.full_name}.` }, { status: 400 });
    }
  }

  let parentProfileId: string | null = null;
  let generatedCredentials: { email: string; password: string } | null = null;

  if (create_parent_login) {
    const email = parent_email && parent_email.trim() !== ""
      ? parent_email.trim()
      : `parent-${(application.parent_contact || "").replace(/\D/g, "")}@gbhspilotdadu.local`;

    const password = parent_password && parent_password.length >= 6
      ? parent_password
      : Math.random().toString(36).slice(-8);

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError || !userData.user) {
      return NextResponse.json({ error: `Could not create parent login: ${userError?.message || "unknown error"}` }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userData.user.id,
      full_name: application.father_name || `Parent of ${student_full_name}`,
      role: "parent",
    });

    if (profileError) {
      return NextResponse.json({ error: `Could not create parent profile: ${profileError.message}` }, { status: 400 });
    }

    parentProfileId = userData.user.id;
    generatedCredentials = { email, password };
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .insert({
      full_name: student_full_name,
      roll_no,
      class_id,
      parent_profile_id: parentProfileId,
      academic_year_id: application.academic_year_id,
      gr_number: gr_number || application.gr_number || null,
      date_of_birth: application.date_of_birth || null,
      photo_path: application.student_photo_path || null,
    })
    .select()
    .single();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 400 });
  }

  await supabaseAdmin
    .from("admission_applications")
    .update({ status: "enrolled", converted_student_id: student.id })
    .eq("id", application_id);

  return NextResponse.json({ success: true, student, credentials: generatedCredentials });
}
