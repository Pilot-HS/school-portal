"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const ROLE_LABELS: Record<string, string> = {
  student: "Student Portal",
  parent: "Parent Portal",
  teacher: "Teacher Portal",
  admin: "Admin Dashboard",
};

export default function PortalNav({
  role,
  fullName,
}: {
  role: string;
  fullName: string;
}) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="topnav">
      <div>
        <div className="brand">GBHS Pilot Dadu</div>
        <div className="role-tag">{ROLE_LABELS[role] || "Portal"}</div>
      </div>
      <div className="right">
        <span>{fullName}</span>
        <button className="btn btn-outline" style={{ borderColor: "#fff", color: "#fff", padding: "6px 14px" }} onClick={handleLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}
