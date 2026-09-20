import { supabaseAdmin, uploadIfPresent } from "@/lib/admissionShared";

export type FormType = "student" | "teacher";

export async function getActiveFieldDefinitions(formType: FormType) {
  const { data } = await supabaseAdmin
    .from("custom_field_definitions")
    .select("*")
    .eq("form_type", formType)
    .eq("is_active", true)
    .order("display_order");
  return data || [];
}

// Reads values for custom_<field_id> keys out of the submitted FormData,
// uploads any file-type fields, and upserts everything into custom_field_values.
export async function saveCustomFieldValues(formData: FormData, formType: FormType, recordId: string) {
  const definitions = await getActiveFieldDefinitions(formType);

  for (const def of definitions) {
    const key = `custom_${def.id}`;

    if (def.field_type === "file") {
      const path = await uploadIfPresent(formData, key);
      if (path) {
        await supabaseAdmin
          .from("custom_field_values")
          .upsert({ field_definition_id: def.id, record_id: recordId, file_path: path, updated_at: new Date().toISOString() }, { onConflict: "field_definition_id,record_id" });
      }
      continue;
    }

    if (!formData.has(key)) continue;
    const raw = formData.get(key);
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value === "") continue;

    await supabaseAdmin
      .from("custom_field_values")
      .upsert({ field_definition_id: def.id, record_id: recordId, value, updated_at: new Date().toISOString() }, { onConflict: "field_definition_id,record_id" });
  }
}

export async function getFieldValuesForRecord(formType: FormType, recordId: string) {
  const definitions = await getActiveFieldDefinitions(formType);
  if (definitions.length === 0) return [];

  const { data: values } = await supabaseAdmin
    .from("custom_field_values")
    .select("*")
    .eq("record_id", recordId)
    .in("field_definition_id", definitions.map((d) => d.id));

  return definitions.map((def) => ({
    definition: def,
    value: (values || []).find((v) => v.field_definition_id === def.id) || null,
  }));
}
