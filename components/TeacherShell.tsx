"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  ClipboardCheck,
  FileText,
  Users,
  BookOpen,
  CalendarOff,
  UserCircle,
  MoreHorizontal,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

type TeacherContextValue = {
  role: string;
  userId: string;
  email: string;
  fullName: string;
  teacher: { id: string; subject: string | null } | null;
  timetable: any[];
  myClassIds: string[];
  classes: any[];
};

const TeacherContext = createContext<TeacherContextValue | null>(null);

export function useTeacher(): TeacherContextValue {
  const value = useContext(TeacherContext);
  if (!value) throw new Error("useTeacher must be used inside the teacher area");
  return value;
}

const TABS = [
  { href: "/teacher", label: "Home", icon: Home },
  { href: "/teacher/attendance", label: "Attendance", icon: ClipboardCheck },
  { href: "/teacher/tests", label: "Tests", icon: FileText },
  { href: "/teacher/students", label: "Students", icon: Users },
  { href: "/teacher/assignments", label: "Assignments", icon: BookOpen },
  { href: "/teacher/leave", label: "Leave", icon: CalendarOff },
  { href: "/teacher/profile", label: "Profile", icon: UserCircle },
];
const BOTTOM_MAIN = TABS.slice(0, 4);
const BOTTOM_MORE = TABS.slice(4);

function Skeleton() {
  return (
    <div className="skeleton-wrap" aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: 120 }} />
      <div className="skeleton" style={{ height: 80 }} />
      <div className="skeleton" style={{ height: 90 }} />
      <div className="skeleton" style={{ height: 220 }} />
    </div>
  );
}

export default function TeacherShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<TeacherContextValue | null>(null);
  const [error, setError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const [{ data: profile }, { data: teacherRow }] = await Promise.all([
        supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single(),
        supabase.from("teachers").select("id, subject").eq("profile_id", session.user.id).maybeSingle(),
      ]);

      if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }

      const [ttRes, classRes] = await Promise.all([
        teacherRow
          ? supabase.from("timetable_entries").select("*, classes(name)").eq("teacher_id", teacherRow.id)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase.from("classes").select("*").order("grade"),
      ]);

      const timetable = ttRes.data || [];
      const myClassIds = Array.from(new Set(timetable.map((e: any) => e.class_id).filter(Boolean))) as string[];

      setState({
        role: profile.role,
        userId: session.user.id,
        email: session.user.email || "",
        fullName: profile.full_name,
        teacher: teacherRow ? { id: teacherRow.id, subject: teacherRow.subject } : null,
        timetable,
        myClassIds,
        classes: classRes.data || [],
      });
    } catch {
      setError("We couldn't load your portal. Please check your internet and try again.");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  // Close the "More" sheet whenever the page changes
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (error) {
    return (
      <div className="skeleton-wrap">
        <div className="t-error" role="alert">
          <span>{error}</span>
          <button className="btn btn-outline" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }
  if (!state) return <Skeleton />;

  const isActive = (href: string) =>
    href === "/teacher" ? pathname === "/teacher" : pathname === href || pathname.startsWith(href + "/");
  const moreActive = BOTTOM_MORE.some((t) => isActive(t.href));

  return (
    <TeacherContext.Provider value={state}>
      <PortalNav role={state.role} fullName={state.fullName} />

      {/* Desktop tabs */}
      <nav className="t-tabs" aria-label="Teacher menu">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={isActive(t.href) ? "active" : ""}>
              <Icon size={16} /> {t.label}
            </Link>
          );
        })}
      </nav>

      <div className="t-shell">{children}</div>

      {/* Phone bottom menu */}
      {moreOpen && (
        <div className="t-sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="t-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="t-sheet-head">
              <strong>More</strong>
              <button className="auth-toggle" style={{ position: "static", transform: "none" }} onClick={() => setMoreOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            {BOTTOM_MORE.map((t) => {
              const Icon = t.icon;
              return (
                <Link key={t.href} href={t.href} className={`t-sheet-link ${isActive(t.href) ? "active" : ""}`}>
                  <Icon size={18} /> {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <nav className="t-bottom" aria-label="Teacher menu">
        {BOTTOM_MAIN.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className={isActive(t.href) ? "active" : ""}>
              <Icon size={20} />
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button type="button" className={moreActive || moreOpen ? "active" : ""} onClick={() => setMoreOpen((v) => !v)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
    </TeacherContext.Provider>
  );
}
