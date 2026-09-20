import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, uploadIfPresent } from "@/lib/admissionShared";
import { saveCustomFieldValues } from "@/lib/customFields";

function str(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const full_name = str(formData, "full_name");

  if (!full_name) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }

  const employee_number = str(formData, "employee_number");
  if (employee_number) {
    const { data: existing } = await supabaseAdmin
      .from("teachers")
      .select("id, full_name")
      .eq("employee_number", employee_number)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `Employee number ${employee_number} is already assigned to ${existing.full_name}.` }, { status: 400 });
    }
  }

  // Optional: create a portal login for this teacher
  let profileId: string | null = null;
  let generatedCredentials: { email: string; password: string } | null = null;
  const createLogin = str(formData, "create_login") === "yes";

  if (createLogin) {
    const loginEmail = str(formData, "email") || `staff-${Date.now()}@gbhspilotdadu.local`;
    const loginPassword = str(formData, "login_password") || Math.random().toString(36).slice(-8);

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: loginEmail,
      password: loginPassword,
      email_confirm: true,
    });

    if (userError || !userData.user) {
      return NextResponse.json({ error: `Could not create login: ${userError?.message || "unknown error"}` }, { status: 400 });
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userData.user.id,
      full_name,
      role: "teacher",
    });
    if (profileError) {
      return NextResponse.json({ error: `Could not create profile: ${profileError.message}` }, { status: 400 });
    }

    profileId = userData.user.id;
    generatedCredentials = { email: loginEmail, password: loginPassword };
  }

  const [photoPath, cnicCopyPath, appointmentOrderPath, degreeCertificatePath, joiningReportPath] = await Promise.all([
    uploadIfPresent(formData, "photo"),
    uploadIfPresent(formData, "cnic_copy"),
    uploadIfPresent(formData, "appointment_order"),
    uploadIfPresent(formData, "degree_certificate"),
    uploadIfPresent(formData, "joining_report"),
  ]);

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .insert({
      full_name,
      profile_id: profileId,
      // Personal
      father_husband_name: str(formData, "father_husband_name"),
      gender: str(formData, "gender"),
      date_of_birth: str(formData, "date_of_birth"),
      cnic: str(formData, "cnic"),
      marital_status: str(formData, "marital_status"),
      religion: str(formData, "religion"),
      domicile: str(formData, "domicile"),
      blood_group: str(formData, "blood_group"),
      photo_path: photoPath,
      // Contact
      mobile_number: str(formData, "mobile_number"),
      emergency_contact: str(formData, "emergency_contact"),
      email: str(formData, "email"),
      current_address: str(formData, "current_address"),
      permanent_address: str(formData, "permanent_address"),
      // Service
      employee_number,
      designation: str(formData, "designation"),
      bps_grade: str(formData, "bps_grade"),
      employment_type: str(formData, "employment_type"),
      date_of_first_appointment: str(formData, "date_of_first_appointment"),
      date_of_joining_school: str(formData, "date_of_joining_school"),
      previous_school: str(formData, "previous_school"),
      status: str(formData, "status") || "Active",
      // Qualifications
      academic_qualification: str(formData, "academic_qualification"),
      qualification_subject: str(formData, "qualification_subject"),
      professional_qualification: str(formData, "professional_qualification"),
      university_board: str(formData, "university_board"),
      passing_year: str(formData, "passing_year"),
      // Documents
      cnic_copy_path: cnicCopyPath,
      appointment_order_path: appointmentOrderPath,
      degree_certificate_path: degreeCertificatePath,
      joining_report_path: joiningReportPath,
      // Legacy field, kept for backward compatibility with existing timetable/assignment links
      subject: str(formData, "qualification_subject"),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await saveCustomFieldValues(formData, "teacher", data.id);

  return NextResponse.json({ success: true, teacher: data, credentials: generatedCredentials });
}
