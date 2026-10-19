import { NextResponse } from "next/server";
import { supabaseAdmin, requireRole } from "@/lib/roleAuth";

// Teachers can update only their own contact details here.
export async function POST(request: Request) {
  const auth = await requireRole(request, ["teacher"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const clean = (v: any) => (typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, 300) : null);

  const { data: teacherRow } = await supabaseAdmin.from("teachers").select("id").eq("profile_id", auth.userId).maybeSingle();
  if (!teacherRow) {
    return NextResponse.json({ error: "No teacher record is linked to your account. Ask the admin to link it." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("teachers")
    .update({
      mobile_number: clean(body.mobile_number),
      emergency_contact: clean(body.emergency_contact),
      current_address: clean(body.current_address),
    })
    .eq("id", teacherRow.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
