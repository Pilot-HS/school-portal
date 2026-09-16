import { NextResponse } from "next/server";
import { supabaseAdmin, buildApplicationRecord } from "@/lib/admissionShared";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  // Spam trap — a hidden field real visitors never fill in
  if (formData.get("honeypot")) {
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }

  const record = await buildApplicationRecord(formData);

  if (!record.student_full_name || !record.parent_contact) {
    return NextResponse.json(
      { error: "Student name and parent contact number are required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const { error } = await supabaseAdmin.from("admission_applications").insert(record);

  if (error) {
    return NextResponse.json(
      { error: "Something went wrong saving your application. Please try again or visit the office." },
      { status: 400, headers: corsHeaders }
    );
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
