import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Allow requests from any origin, since the public website (on a different
// domain, e.g. GitHub Pages) needs to call this endpoint directly.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { student_name, parent_name, phone, email, grade_applying, notes, honeypot } = body;

  // Simple spam trap: a hidden field real users never fill in
  if (honeypot) {
    return NextResponse.json({ success: true }, { headers: corsHeaders });
  }

  if (!student_name || !parent_name || !phone) {
    return NextResponse.json(
      { error: "Student name, parent name, and phone number are required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const { error } = await supabaseAdmin.from("admissions").insert({
    student_name,
    parent_name,
    phone,
    email: email || null,
    grade_applying: grade_applying || null,
    notes: notes || null,
    status: "new",
  });

  if (error) {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 400, headers: corsHeaders });
  }

  return NextResponse.json({ success: true }, { headers: corsHeaders });
}
