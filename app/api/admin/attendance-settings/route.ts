import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/admissionShared";
import { getAttendanceSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json(await getAttendanceSettings());
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const lockDays = Math.round(Number(body.lock_days));
  const low = Math.round(Number(body.low_threshold));
  if (!Number.isFinite(lockDays) || lockDays < 0 || lockDays > 365) return NextResponse.json({ error: "Lock days must be between 0 and 365 (0 means never lock)." }, { status: 400 });
  if (!Number.isFinite(low) || low < 1 || low > 100) return NextResponse.json({ error: "The low-attendance limit must be between 1 and 100." }, { status: 400 });

  const { error } = await supabaseAdmin.from("portal_settings").upsert(
    [
      { key: "attendance_lock_days", value: String(lockDays) },
      { key: "attendance_low_threshold", value: String(low) },
    ],
    { onConflict: "key" }
  );
  if (error) {
    const needs = /portal_settings/.test(error.message) && /(does not exist|schema cache)/i.test(error.message);
    return NextResponse.json({ error: needs ? "The settings table has not been created yet. Run setup-database.sql first." : error.message, setup_needed: needs }, { status: needs ? 503 : 400 });
  }
  await logAudit(auth.userId, "settings", `Attendance settings: lock after ${lockDays} days, low limit ${low}%`);
  return NextResponse.json({ success: true });
}
