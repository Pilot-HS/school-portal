import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BUCKET = "admission-documents";

export async function uploadIfPresent(formData: FormData, field: string): Promise<string | null> {
  const file = formData.get(field) as File | null;
  if (!file || typeof file === "string" || file.size === 0) return null;

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || "image/jpeg",
  });

  if (error) {
    console.error("Upload failed for", field, error.message);
    return null;
  }
  return path;
}

function str(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

export async function buildApplicationRecord(formData: FormData) {
  const [studentPhotoPath, bformImagePath, cnicFrontPath, cnicBackPath, certPath] = await Promise.all([
    uploadIfPresent(formData, "student_photo"),
    uploadIfPresent(formData, "bform_image"),
    uploadIfPresent(formData, "father_cnic_front"),
    uploadIfPresent(formData, "father_cnic_back"),
    uploadIfPresent(formData, "last_school_certificate"),
  ]);

  return {
    student_full_name: str(formData, "student_full_name"),
    student_photo_path: studentPhotoPath,
    gender: str(formData, "gender"),
    date_of_birth: str(formData, "date_of_birth"),
    place_of_birth: str(formData, "place_of_birth"),
    nationality: str(formData, "nationality") || "Pakistani",
    religion: str(formData, "religion"),
    blood_group: str(formData, "blood_group"),
    bform_number: str(formData, "bform_number"),
    bform_image_path: bformImagePath,
    student_contact: str(formData, "student_contact"),
    student_email: str(formData, "student_email"),
    city: str(formData, "city"),

    father_name: str(formData, "father_name"),
    father_occupation: str(formData, "father_occupation"),
    caste: str(formData, "caste"),
    guardian_relationship: str(formData, "guardian_relationship") || "Father",
    father_cnic: str(formData, "father_cnic"),
    father_cnic_front_path: cnicFrontPath,
    father_cnic_back_path: cnicBackPath,
    parent_contact: str(formData, "parent_contact"),

    last_school_name: str(formData, "last_school_name"),
    last_school_class: str(formData, "last_school_class"),
    last_school_certificate_path: certPath,
    class_applying_for: str(formData, "class_applying_for"),

    sibling_enrolled: str(formData, "sibling_enrolled") === "yes",
    sibling_name: str(formData, "sibling_name"),
    declaration_accepted: str(formData, "declaration_accepted") === "yes",

    status: "new" as const,
  };
}
