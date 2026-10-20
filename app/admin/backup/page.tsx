"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AdminLayout from "@/components/AdminLayout";
import { localISODate } from "@/lib/teacherUi";

const ITEMS = [
  { type: "students", title: "Students", desc: "Every student with class, roll number, GR number and all saved details" },
  { type: "teachers", title: "Teachers & staff", desc: "All staff records" },
  { type: "results", title: "Exam results", desc: "Every mark for every student, test and subject" },
  { type: "assignments", title: "Assignments", desc: "All homework posted" },
  { type: "notices", title: "Notices", desc: "All notices with their full text" },
  { type: "fees", title: "Fee records", desc: "Charges and whether each is paid" },
];

export default function BackupPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return localISODate(d);
  });
  const [to, setTo] = useState(localISODate());

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", session.user.id).single();
      if (!profile || profile.role !== "admin") {
        router.replace(profile?.role ? `/${profile.role}` : "/login");
        return;
      }
      setFullName(profile.full_name);
      setReady(true);
    })();
  }, [router]);

  async function download(type: string) {
    setBusy(type);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const qs = new URLSearchParams({ type });
      if (type === "attendance") {
        qs.set("from", from);
        qs.set("to", to);
      }
      const res = await fetch(`/api/admin/export?${qs.toString()}`, { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not create the file.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = type === "attendance" ? `attendance-${from}-to-${to}.csv` : `${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    }
    setBusy("");
  }

  if (!ready) return <div className="skeleton-wrap"><div className="skeleton" style={{ height: 200 }} /></div>;

  return (
    <AdminLayout active="reports" fullName={fullName}>
      <h1 className="t-page-title">Backup &amp; Export</h1>
      <p style={{ color: "var(--muted)", maxWidth: 680, marginTop: -6 }}>
        Download a copy of the school&apos;s data as spreadsheet files that open in Excel. Keep a copy somewhere safe, for example once a month and at the end of each term.
      </p>
      {error && <div className="t-error" role="alert"><span>{error}</span></div>}

      <div className="t-list" style={{ maxWidth: 720 }}>
        {ITEMS.map((i) => (
          <div className="t-test-card" key={i.type} style={{ cursor: "default" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-test-name">{i.title}</div>
              <div className="t-test-meta">{i.desc}</div>
            </div>
            <button className="btn btn-outline" onClick={() => download(i.type)} disabled={!!busy}>
              <Download size={15} /> {busy === i.type ? "Preparing…" : "Download"}
            </button>
          </div>
        ))}

        <div className="t-test-card" style={{ cursor: "default", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="t-test-name">Attendance</div>
            <div className="t-test-meta">Daily attendance for the dates you choose</div>
            <div className="t-form-row" style={{ marginTop: 10, maxWidth: 380 }}>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="b_from">From</label>
                <input id="b_from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="form-field" style={{ marginBottom: 0 }}>
                <label htmlFor="b_to">To</label>
                <input id="b_to" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => download("attendance")} disabled={!!busy}>
            <Download size={15} /> {busy === "attendance" ? "Preparing…" : "Download"}
          </button>
        </div>
      </div>
      <p className="t-hint">For attendance, a month or a term at a time works best. These files contain personal information, so store them safely.</p>
    </AdminLayout>
  );
}
