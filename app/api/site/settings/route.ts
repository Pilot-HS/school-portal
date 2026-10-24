import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/roleAuth";
import { requireEditor } from "../_auth";
import { cleanSettings } from "@/lib/site/validate";
import { logAudit } from "@/lib/audit";

// PUT {general, footer} -> the school name, contact details and footer shown on every page. Goes live immediately.
export async function PUT(request: Request) {
  const auth = await requireEditor(request, true);
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const clean = cleanSettings(body.general, body.footer);
  if (!clean.general.school_name) return NextResponse.json({ error: "The school name can't be empty." }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("site_settings").upsert(
    [
      { key: "general", draft: clean.general, published: clean.general, updated_at: now },
      { key: "footer", draft: clean.footer, published: clean.footer, updated_at: now },
    ],
    { onConflict: "key" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(auth.userId, "website", "Changed the website's school details and footer");
  return NextResponse.json({ success: true });
}
