import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("academic_years")
    .select("id, label, is_current")
    .order("label", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
  }

  return NextResponse.json({ academic_years: data }, { headers: corsHeaders });
}
