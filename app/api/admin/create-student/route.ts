import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin, uploadIfPresent } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const formData = await request.formData();
  const full_name = formData.get("full_name") as string;
  const roll_no = formData.get("roll_no") as string;
  const class_id = formData.get("class_id") as string;
  const profile_id = (formData.get("profile_id") as string) || null;
  const parent_profile_id = (formData.get("parent_profile_id") as string) || null;
  const academic_year_id = (formData.get("academic_year_id") as string) || null;
  const gr_number = (formData.get("gr_number") as string) || null;
  const date_of_birth = (formData.get("date_of_birth") as string) || null;

  if (!full_name || !roll_no || !class_id) {
    return NextResponse.json({ error: "Name, roll number, and class are required" }, { status: 400 });
  }

  const { data: existingRoll } = await supabaseAdmin
    .from("students")
    .select("id, full_name")
    .eq("class_id", class_id)
    .eq("roll_no", roll_no)
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
      .maybeSingle();
    if (existingGr) {
      return NextResponse.json({ error: `GR number ${gr_number} is already assigned to ${existingGr.full_name}.` }, { status: 400 });
    }
  }

  const photoPath = await uploadIfPresent(formData, "photo");

  const { data, error } = await supabaseAdmin
    .from("students")
    .insert({
      full_name,
      roll_no,
      class_id,
      profile_id,
      parent_profile_id,
      academic_year_id,
      gr_number,
      date_of_birth,
      photo_path: photoPath,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, student: data });
}
