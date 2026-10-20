import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roleAuth";
import { getAllowedClassIds } from "@/lib/teacherAccess";

// The classes the logged-in teacher may work with right now (timetable + substitute cover).
export async function GET(request: Request) {
  const auth = await requireRole(request, ["teacher", "admin"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.role === "admin") return NextResponse.json({ all: true, class_ids: [] });
  const { classIds } = await getAllowedClassIds(auth.userId);
  return NextResponse.json({ all: false, class_ids: classIds });
}
