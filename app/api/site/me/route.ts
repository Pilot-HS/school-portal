import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roleAuth";
import { getSiteAccess } from "@/lib/site/access";

// Can the logged-in person change the website?
export async function GET(request: Request) {
  const auth = await requireRole(request, ["admin", "teacher", "student", "parent"]);
  if ("error" in auth) return NextResponse.json({ canEdit: false, canPublish: false }, { status: 200 });
  const access = await getSiteAccess(auth.userId, auth.role);
  return NextResponse.json({ ...access, role: auth.role });
}
