import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 });
  }

  const [{ data: profiles }, { data: students }, { data: teachers }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, full_name, role"),
    supabaseAdmin.from("students").select("full_name, profile_id, parent_profile_id"),
    supabaseAdmin.from("teachers").select("full_name, profile_id"),
  ]);

  const logins = (profiles || []).map((p: any) => {
    const user = usersData.users.find((u: any) => u.id === p.id);
    let linkedTo = "";
    if (p.role === "student") {
      const s = (students || []).find((x: any) => x.profile_id === p.id);
      linkedTo = s ? s.full_name : "";
    } else if (p.role === "parent") {
      linkedTo = (students || []).filter((x: any) => x.parent_profile_id === p.id).map((k: any) => k.full_name).join(", ");
    } else if (p.role === "teacher") {
      const t = (teachers || []).find((x: any) => x.profile_id === p.id);
      linkedTo = t ? t.full_name : "";
    }
    return {
      id: p.id,
      email: user?.email || "",
      full_name: p.full_name,
      role: p.role,
      linked_to: linkedTo,
      created_at: user?.created_at || "",
    };
  });

  logins.sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));

  return NextResponse.json({ logins });
}
