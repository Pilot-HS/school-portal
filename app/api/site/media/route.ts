import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";

// GET -> the most recently uploaded pictures
export async function GET(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;
  const { data, error } = await supabaseAdmin.from("site_media").select("id, url, created_at").order("created_at", { ascending: false }).limit(60);
  if (error) return NextResponse.json({ media: [] });
  return NextResponse.json({ media: data || [] });
}
