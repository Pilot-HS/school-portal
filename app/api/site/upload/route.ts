import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { logAudit } from "@/lib/audit";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
const MAX_BYTES = 6 * 1024 * 1024;

// POST (form-data "file") -> stores a picture for the website and returns its address
export async function POST(request: Request) {
  const auth = await requireEditor(request);
  if ("error" in auth) return auth.error;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The picture couldn't be read." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a picture." }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Please choose a JPG, PNG, WebP or GIF picture." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That picture is too large (6 MB at most)." }, { status: 400 });

  const now = new Date();
  const path = `uploads/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from("site-media").upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) {
    const missing = /bucket/i.test(error.message) && /not found/i.test(error.message);
    return NextResponse.json({ error: missing ? "The picture storage isn't set up yet. Run setup-database.sql in Supabase." : error.message }, { status: missing ? 503 : 400 });
  }
  const url = supabaseAdmin.storage.from("site-media").getPublicUrl(path).data.publicUrl;
  await supabaseAdmin.from("site_media").insert({ path, url, size: file.size, uploaded_by: auth.userId });
  await logAudit(auth.userId, "website", "Uploaded a picture for the website", { path });
  return NextResponse.json({ success: true, url });
}
