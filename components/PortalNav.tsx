"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
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

  const initial = (fullName || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="topnav">
      <div className="nav-left">
        <div className="nav-mark">G</div>
        <div>
          <div className="brand">GBHS Pilot Dadu</div>
          <div className="role-tag">{ROLE_LABELS[role] || "Portal"}</div>
        </div>
      </div>
      <div className="right">
        <div className="nav-user">
          <div className="nav-avatar" aria-hidden="true">{initial}</div>
          <span className="nav-name">{fullName}</span>
        </div>
        <button className="btn btn-logout" onClick={handleLogout} aria-label="Log out">
          <LogOut size={15} /> <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
