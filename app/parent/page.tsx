"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Award, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import PortalNav from "@/components/PortalNav";

export default function ParentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<any>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "parent") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);

      const { data: kids } = await supabase
        .from("students")
        .select("*, classes(name)")
        .eq("parent_profile_id", session.user.id);
      setChildren(kids || []);
      if (kids && kids.length > 0) setSelectedChild(kids[0]);

      const { data: noticesData } = await supabase
        .from("notices")
        .select("*")
        .in("audience", ["all", "parents"])
        .order("created_at", { ascending: false })
        .limit(5);
      setNotices(noticesData || []);

      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    if (!selectedChild) return;
    (async () => {
      const [{ data: att }, { data: res }, { data: fee }] = await Promise.all([
        supabase.from("attendance").select("*").eq("student_id", selectedChild.id).order("date", { ascending: false }).limit(10),
        supabase.from("exam_results").select("*").eq("student_id", selectedChild.id),
        supabase.from("fees").select("*").eq("student_id", selectedChild.id),
      ]);
      setAttendance(att || []);
      setResults(res || []);
      setFees(fee || []);
    })();
  }, [selectedChild]);

  if (loading) return <div className="loading-shell">Loading&hellip;</div>;

  return (
    <div>
      <PortalNav role="parent" fullName={fullName} />
      <div className="portal-main">
        <h1 style={{ fontSize: "1.5rem" }}>Welcome, {fullName}</h1>

        {children.length === 0 ? (
          <div className="portal-panel">
            <h2>No children linked yet</h2>
            <p>Your login works, but the school admin hasn't linked a student to your account yet. Ask the office to complete this step.</p>
          </div>
        ) : (
          <>
            {children.length > 1 && (
              <div className="portal-panel">
                <h2>Your Children</h2>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {children.map((c) => (
                    <button
                      key={c.id}
                      className="btn btn-outline"
                      style={{ background: selectedChild?.id === c.id ? "var(--accent-tint)" : "transparent" }}
                      onClick={() => setSelectedChild(c)}
                    >
                      {c.full_name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p style={{ color: "var(--muted)", marginBottom: "24px" }}>
              Viewing: <strong>{selectedChild?.full_name}</strong> &middot; {selectedChild?.classes?.name || "No class assigned"} &middot; Roll No. {selectedChild?.roll_no}
            </p>

            <div className="portal-cards">
              <div className="icon-stat-card">
                <div className="icon-badge icon-badge-green"><CalendarCheck size={18} /></div>
                <div className="icon-stat-num">{attendance.filter((a) => a.status === "present").length}/{attendance.length}</div>
                <div className="icon-stat-label">Days present (recent)</div>
              </div>
              <div className="icon-stat-card">
                <div className="icon-badge icon-badge-blue"><Award size={18} /></div>
                <div className="icon-stat-num">{results.length}</div>
                <div className="icon-stat-label">Recorded exam results</div>
              </div>
              <div className="icon-stat-card">
                <div className="icon-badge icon-badge-red"><Wallet size={18} /></div>
                <div className="icon-stat-num">{fees.filter((f) => f.status === "unpaid").length}</div>
                <div className="icon-stat-label">Unpaid charges</div>
              </div>
            </div>

            <div className="portal-panel">
              <h2>Recent Attendance</h2>
              {attendance.length === 0 ? <p>No attendance records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id}>
                        <td>{a.date}</td>
                        <td><span className={`pill ${a.status === "present" ? "pill-green" : a.status === "leave" ? "pill-amber" : "pill-red"}`}>{a.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="portal-panel">
              <h2>Exam Results</h2>
              {results.length === 0 ? <p>No results recorded yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Subject</th><th>Exam</th><th>Marks</th></tr></thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id}><td>{r.subject}</td><td>{r.exam_name}</td><td>{r.marks_obtained} / {r.total_marks}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="portal-panel">
              <h2>Fees</h2>
              {fees.length === 0 ? <p>No fee records yet.</p> : (
                <table className="data-table">
                  <thead><tr><th>Charge</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {fees.map((f) => (
                      <tr key={f.id}><td>{f.charge_name}</td><td>PKR {f.amount}</td><td><span className={`pill ${f.status === "paid" ? "pill-green" : "pill-red"}`}>{f.status}</span></td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        <div className="portal-panel">
          <h2>Notices</h2>
          {notices.length === 0 ? <p>No notices posted yet.</p> : (
            <table className="data-table">
              <thead><tr><th>Date</th><th>Notice</th></tr></thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}><td>{new Date(n.created_at).toLocaleDateString()}</td><td>{n.title}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
