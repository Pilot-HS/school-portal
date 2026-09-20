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
  const teacher_id = str(formData, "teacher_id");
  const full_name = str(formData, "full_name");

  if (!teacher_id || !full_name) {
    return NextResponse.json({ error: "Teacher ID and full name are required" }, { status: 400 });
  }

  const employee_number = str(formData, "employee_number");
  if (employee_number) {
    const { data: existing } = await supabaseAdmin
      .from("teachers")
      .select("id, full_name")
      .eq("employee_number", employee_number)
      .neq("id", teacher_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: `Employee number ${employee_number} is already assigned to ${existing.full_name}.` }, { status: 400 });
    }
  }

  const updates: Record<string, any> = {
    full_name,
    profile_id: str(formData, "profile_id"),
    father_husband_name: str(formData, "father_husband_name"),
    gender: str(formData, "gender"),
    date_of_birth: str(formData, "date_of_birth"),
    cnic: str(formData, "cnic"),
    marital_status: str(formData, "marital_status"),
    religion: str(formData, "religion"),
    domicile: str(formData, "domicile"),
    blood_group: str(formData, "blood_group"),
    mobile_number: str(formData, "mobile_number"),
    emergency_contact: str(formData, "emergency_contact"),
    email: str(formData, "email"),
    current_address: str(formData, "current_address"),
    permanent_address: str(formData, "permanent_address"),
    employee_number,
    designation: str(formData, "designation"),
    bps_grade: str(formData, "bps_grade"),
    employment_type: str(formData, "employment_type"),
    date_of_first_appointment: str(formData, "date_of_first_appointment"),
    date_of_joining_school: str(formData, "date_of_joining_school"),
    previous_school: str(formData, "previous_school"),
    status: str(formData, "status") || "Active",
    academic_qualification: str(formData, "academic_qualification"),
    qualification_subject: str(formData, "qualification_subject"),
    professional_qualification: str(formData, "professional_qualification"),
    university_board: str(formData, "university_board"),
    passing_year: str(formData, "passing_year"),
    subject: str(formData, "qualification_subject"),
  };

  const [photoPath, cnicCopyPath, appointmentOrderPath, degreeCertificatePath, joiningReportPath] = await Promise.all([
    uploadIfPresent(formData, "photo"),
    uploadIfPresent(formData, "cnic_copy"),
    uploadIfPresent(formData, "appointment_order"),
    uploadIfPresent(formData, "degree_certificate"),
    uploadIfPresent(formData, "joining_report"),
  ]);
  if (photoPath) updates.photo_path = photoPath;
  if (cnicCopyPath) updates.cnic_copy_path = cnicCopyPath;
  if (appointmentOrderPath) updates.appointment_order_path = appointmentOrderPath;
  if (degreeCertificatePath) updates.degree_certificate_path = degreeCertificatePath;
  if (joiningReportPath) updates.joining_report_path = joiningReportPath;

  const { data, error } = await supabaseAdmin
    .from("teachers")
    .update(updates)
    .eq("id", teacher_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await saveCustomFieldValues(formData, "teacher", teacher_id);

  return NextResponse.json({ success: true, teacher: data });
}
