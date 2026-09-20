import { NextResponse } from "next/server";
import { supabaseAdmin, requireAdmin } from "@/lib/adminAuth";

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { house, points, reason } = body;

  if (!house || points === undefined || points === null) {
    return NextResponse.json({ error: "House and points are required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("house_points").insert({ house, points: Number(points), reason: reason || null });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
