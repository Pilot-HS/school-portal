"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  GraduationCap,
  Wallet,
  LayoutDashboard,
  UserPlus,
  School,
  Megaphone,
  ClipboardCheck,
  BookOpen,
  Award,
  UserCheck,
  CalendarClock,
  FileBarChart,
  CalendarOff,
  Clock,
  Library,
  Flag,
  CalendarDays,
  Medal,
  CalendarRange,
  MoreHorizontal,
  X,
} from "lucide-react";
import PortalNav from "@/components/PortalNav";

type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: any;
  extra?: boolean; // pages that used to be reachable only from inside other pages
};

const GROUPS: { title: string | null; items: NavItem[] }[] = [
  {
    title: null,
    items: [{ key: "dashboard", href: "/admin", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    title: "People",
    items: [
      { key: "admissions", href: "/admin/admissions", label: "Admissions", icon: UserCheck },
      { key: "students", href: "/admin/students", label: "Students", icon: Users },
      { key: "teachers", href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
      { key: "classes", href: "/admin/classes", label: "Classes", icon: School },
    ],
  },
  {
    title: "Academics",
    items: [
      { key: "attendance", href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
      { key: "assignments", href: "/admin/assignments", label: "Assignments", icon: BookOpen },
      { key: "exams", href: "/admin/exams", label: "Exams & Results", icon: Award },
      { key: "timetable", href: "/admin/timetable", label: "Timetable", icon: CalendarClock },
    ],
  },
  {
    title: "School",
    items: [
      { key: "fees", href: "/admin/fees", label: "Fees", icon: Wallet },
      { key: "notices", href: "/admin/notices", label: "Notices", icon: Megaphone },
      { key: "reports", href: "/admin/reports", label: "Reports", icon: FileBarChart },
      { key: "accounts", href: "/admin/create-user", label: "Accounts", icon: UserPlus },
      { key: "bulk-logins", href: "/admin/bulk-logins", label: "Bulk Logins", icon: UserPlus, extra: true },
      { key: "report-cards", href: "/admin/report-cards", label: "Report Cards", icon: Award, extra: true },
    ],
  },
  {
    title: "Staff & Setup",
    items: [
      { key: "cover", href: "/admin/cover", label: "Substitute Cover", icon: UserCheck, extra: true },
      { key: "leave", href: "/admin/leave-requests", label: "Leave Requests", icon: CalendarOff, extra: true },
      { key: "staff-attendance", href: "/admin/staff-attendance", label: "Staff Attendance", icon: Clock, extra: true },
      { key: "subjects", href: "/admin/subjects", label: "Subjects", icon: Library, extra: true },
      { key: "houses", href: "/admin/houses", label: "Houses", icon: Flag, extra: true },
      { key: "exam-schedule", href: "/admin/exams-schedule", label: "Exam Schedule", icon: CalendarRange, extra: true },
      { key: "grading", href: "/admin/grading-scale", label: "Grading Scale", icon: Medal, extra: true },
      { key: "years", href: "/admin/academic-years", label: "Academic Years", icon: CalendarDays, extra: true },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);
const BOTTOM_KEYS = ["dashboard", "students", "teachers", "fees"];

export default function AdminLayout({
  active,
  fullName,
  children,
}: {
  active: string;
  fullName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "";
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Pages under "Staff & Setup" are highlighted by their address;
  // every other page keeps using the `active` value it already passes in.
  const extraMatch = ALL_ITEMS.find(
    (i) => i.extra && (pathname === i.href || pathname.startsWith(i.href + "/"))
  );
  const activeKey = extraMatch ? extraMatch.key : active;

  const bottomItems = BOTTOM_KEYS.map((k) => ALL_ITEMS.find((i) => i.key === k)!).filter(Boolean);
  const moreIsActive = !BOTTOM_KEYS.includes(activeKey);

  return (
    <div>
      <PortalNav role="admin" fullName={fullName} />
      <div className="admin-shell">
        <div className="admin-sidebar">
          {GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.title && <div className="admin-group-title">{group.title}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.key} href={item.href} className={item.key === activeKey ? "active" : ""}>
                    <Icon size={16} /> {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className="admin-content">{children}</div>
      </div>

      {/* Phone menu */}
      {moreOpen && (
        <div className="t-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="t-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="t-sheet-head">
              <strong>Menu</strong>
              <button
                className="auth-toggle"
                style={{ position: "static", transform: "none" }}
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            {GROUPS.map((group, gi) => (
              <div key={gi}>
                {group.title && <div className="t-sheet-group">{group.title}</div>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.key} href={item.href} className={`t-sheet-link ${item.key === activeKey ? "active" : ""}`}>
                      <Icon size={18} /> {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      <nav className="t-bottom" aria-label="Admin menu">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.key} href={item.href} className={item.key === activeKey ? "active" : ""}>
              <Icon size={20} />
              <span>{item.key === "dashboard" ? "Home" : item.label}</span>
            </Link>
          );
        })}
        <button type="button" className={moreIsActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen((v) => !v)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
}
