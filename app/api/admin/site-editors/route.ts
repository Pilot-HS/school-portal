import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { logAudit } from "@/lib/audit";

function setupProblem(error: any) {
  const msg = String(error?.message || "");
  if (/site_editors/.test(msg) && /(does not exist|schema cache)/i.test(msg)) {
    return NextResponse.json({ error: "The website tables have not been created yet.", setup_needed: true }, { status: 503 });
  }
  return null;
}

// GET            -> everyone who has been given permission
// GET ?q=ahmed   -> also searches teachers, students and parents by name
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = (new URL(request.url).searchParams.get("q") || "").replace(/[%_,()]/g, " ").trim();
  const { data, error } = await supabaseAdmin.from("site_editors").select("*").order("created_at", { ascending: false });
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (data || []).map((e: any) => e.user_id);
  const names: Record<string, { name: string; role: string }> = {};
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, full_name, role").in("id", ids);
    (profiles || []).forEach((p: any) => (names[p.id] = { name: p.full_name, role: p.role }));
  }

  let people: any[] = [];
  if (q.length >= 2) {
    const { data: found } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["teacher", "student", "parent"])
      .ilike("full_name", `%${q}%`)
      .limit(15);
    people = found || [];
  }

  return NextResponse.json({
    editors: (data || []).map((e: any) => ({
      user_id: e.user_id,
      name: names[e.user_id]?.name || "Unknown",
      role: names[e.user_id]?.role || "",
      can_publish: !!e.can_publish,
      expires_at: e.expires_at,
      expired: !!e.expires_at && new Date(e.expires_at).getTime() < Date.now(),
      note: e.note,
    })),
    people,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const userId = String(body.user_id || "");
  if (!userId) return NextResponse.json({ error: "Choose a person." }, { status: 400 });

  const { data: profile } = await supabaseAdmin.from("profiles").select("id, full_name, role").eq("id", userId).maybeSingle();
  if (!profile) return NextResponse.json({ error: "That person wasn't found." }, { status: 404 });
  if (profile.role === "admin") return NextResponse.json({ error: "Admins can already edit the website." }, { status: 400 });

  let expires: string | null = null;
  if (body.expires_on) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.expires_on)) return NextResponse.json({ error: "That end date isn't valid." }, { status: 400 });
    expires = new Date(`${body.expires_on}T23:59:59+05:00`).toISOString(); // end of that day in Pakistan
  }

  const { error } = await supabaseAdmin.from("site_editors").upsert(
    {
      user_id: userId,
      can_publish: body.can_publish === true,
      expires_at: expires,
      note: body.note ? String(body.note).slice(0, 150) : null,
      granted_by: auth.userId,
    },
    { onConflict: "user_id" }
  );
  if (error) return setupProblem(error) || NextResponse.json({ error: error.message }, { status: 400 });

  await logAudit(auth.userId, "website", `Gave ${profile.full_name} permission to edit the website${body.can_publish ? " and publish" : ""}${expires ? ` until ${body.expires_on}` : ""}`, { user_id: userId });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { user_id } = await request.json();
  if (!user_id) return NextResponse.json({ error: "Choose a person." }, { status: 400 });
  const { error } = await supabaseAdmin.from("site_editors").delete().eq("user_id", user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await logAudit(auth.userId, "website", "Removed someone's permission to edit the website", { user_id });
  return NextResponse.json({ success: true });
}
