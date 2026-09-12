"use client";

import Link from "next/link";
import { Users, GraduationCap, Wallet, LayoutDashboard, UserPlus, School, Megaphone, ClipboardCheck } from "lucide-react";
import PortalNav from "@/components/PortalNav";

const NAV_ITEMS = [
  { key: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { key: "students", href: "/admin/students", label: "Students", icon: Users },
  { key: "teachers", href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  { key: "classes", href: "/admin/classes", label: "Classes", icon: School },
  { key: "attendance", href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { key: "fees", href: "/admin/fees", label: "Fees", icon: Wallet },
  { key: "notices", href: "/admin/notices", label: "Notices", icon: Megaphone },
  { key: "accounts", href: "/admin/create-user", label: "Accounts", icon: UserPlus },
];

export default function AdminLayout({
  active,
  fullName,
  children,
}: {
  active: string;
  fullName: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="admin-shell">
        <div className="admin-sidebar">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.key} href={item.href} className={item.key === active ? "active" : ""}>
                <Icon size={16} /> {item.label}
              </Link>
            );
          })}
        </div>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
