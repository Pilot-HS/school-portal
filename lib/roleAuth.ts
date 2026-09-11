import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RoleAuthResult = { userId: string; role: string } | { error: string; status: number };

export async function requireRole(request: Request, allowedRoles: string[]): Promise<RoleAuthResult> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return { error: "Not authenticated", status: 401 };
  }

  const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !callerData.user) {
    return { error: "Invalid session", status: 401 };
  }

  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .single();

  if (!callerProfile || !allowedRoles.includes(callerProfile.role)) {
    return { error: "You don't have permission to do this", status: 403 };
  }

  return { userId: callerData.user.id, role: callerProfile.role };
}
