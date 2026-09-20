import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, uploadIfPresent } from "@/lib/admissionShared";
import { saveCustomFieldValues } from "@/lib/customFields";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const student_id = formData.get("student_id") as string;
  const full_name = formData.get("full_name") as string;
  const roll_no = formData.get("roll_no") as string;
  const class_id = formData.get("class_id") as string;
  const profile_id = (formData.get("profile_id") as string) || null;
  const parent_profile_id = (formData.get("parent_profile_id") as string) || null;
  const gr_number = (formData.get("gr_number") as string) || null;
  const date_of_birth = (formData.get("date_of_birth") as string) || null;
  const house = (formData.get("house") as string) || null;

  if (!student_id || !full_name || !roll_no || !class_id) {
    return NextResponse.json({ error: "Student ID, name, roll number, and class are required" }, { status: 400 });
  }

  const { data: beforeUpdate } = await supabaseAdmin.from("students").select("class_id").eq("id", student_id).single();

  const { data: existingRoll } = await supabaseAdmin
    .from("students")
    .select("id, full_name")
    .eq("class_id", class_id)
    .eq("roll_no", roll_no)
    .neq("id", student_id)
    .maybeSingle();

  if (existingRoll) {
    return NextResponse.json(
      { error: `Roll number ${roll_no} is already used by ${existingRoll.full_name} in this class. Choose a different roll number.` },
      { status: 400 }
    );
  }

  if (gr_number) {
    const { data: existingGr } = await supabaseAdmin
      .from("students")
      .select("id, full_name")
      .eq("gr_number", gr_number)
      .neq("id", student_id)
      .maybeSingle();
    if (existingGr) {
      return NextResponse.json({ error: `GR number ${gr_number} is already assigned to ${existingGr.full_name}.` }, { status: 400 });
    }
  }

  const updates: Record<string, any> = {
    full_name,
    roll_no,
    class_id,
    profile_id,
    parent_profile_id,
    gr_number,
    date_of_birth,
    house,
  };

  // Academic year is optional and only updated if the form included the field
  if (formData.has("academic_year_id")) {
    updates.academic_year_id = (formData.get("academic_year_id") as string) || null;
  }

  const newPhotoPath = await uploadIfPresent(formData, "photo");
  if (newPhotoPath) {
    updates.photo_path = newPhotoPath;
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", student_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (beforeUpdate && beforeUpdate.class_id !== class_id) {
    await supabaseAdmin.from("student_history").insert({
      student_id,
      event_type: "class_change",
      details: `Class changed via edit`,
    });
  }

  await saveCustomFieldValues(formData, "student", student_id);

  return NextResponse.json({ success: true, student: data });
}
