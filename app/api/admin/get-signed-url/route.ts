import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { path } = body;

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from("admission-documents")
    .createSignedUrl(path, 3600); // valid for 1 hour

  if (error || !data) {
    return NextResponse.json({ error: "Could not generate a link for this file" }, { status: 400 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
