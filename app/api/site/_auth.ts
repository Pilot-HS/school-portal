import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roleAuth";
import { getSiteAccess } from "@/lib/site/access";

// Shared check for the editing routes: logged in, and allowed to edit the website.
export async function requireEditor(request: Request, needPublish = false) {
  const auth = await requireRole(request, ["admin", "teacher", "student", "parent"]);
  if ("error" in auth) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  const access = await getSiteAccess(auth.userId, auth.role);
  if (!access.canEdit) return { error: NextResponse.json({ error: "You don't have permission to edit the website." }, { status: 403 }) } as const;
  if (needPublish && !access.canPublish) return { error: NextResponse.json({ error: "You can edit, but only an admin can publish. Your changes are saved as a draft." }, { status: 403 }) } as const;
  return { userId: auth.userId, role: auth.role, access } as const;
}
