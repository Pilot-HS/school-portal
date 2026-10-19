"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useTeacher } from "@/components/TeacherShell";
import { teacherApi } from "@/lib/teacherApi";
import { formatDate } from "@/lib/teacherUi";

export default function ProfilePage() {
  const { teacher, fullName, email } = useTeacher();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mobile, setMobile] = useState("");
  const [emergency, setEmergency] = useState("");
  const [address, setAddress] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      if (teacher) {
        const { data } = await supabase.from("teachers").select("*").eq("id", teacher.id).maybeSingle();
        if (data) {
          setInfo(data);
          setMobile(data.mobile_number || "");
          setEmergency(data.emergency_contact || "");
          setAddress(data.current_address || "");
        }
      }
      setLoading(false);
    })();
  }, [teacher]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setSavingContact(true);
    setContactMsg(null);
    const { ok, data } = await teacherApi("/api/teacher/update-my-profile", {
      body: { mobile_number: mobile, emergency_contact: emergency, current_address: address },
    });
    setContactMsg(ok ? { type: "success", text: "Contact details saved." } : { type: "error", text: data.error || "Could not save." });
    setSavingContact(false);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 8) {
      setPwMsg({ type: "error", text: "The new password must be at least 8 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "The new passwords don't match." });
      return;
    }
    if (newPw === currentPw) {
      setPwMsg({ type: "error", text: "The new password must be different from the current one." });
      return;
    }
    setSavingPw(true);
    // Check the current password first
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (checkError) {
      setPwMsg({ type: "error", text: "Your current password is not correct." });
      setSavingPw(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      setPwMsg({ type: "error", text: error.message || "Could not change the password." });
    } else {
      setPwMsg({ type: "success", text: "Password changed. Use the new one next time you log in." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setSavingPw(false);
  }

  const rows: [string, string][] = [
    ["Name", fullName],
    ["Login email", email],
    ["Subject", info?.subject || teacher?.subject || "—"],
    ["Designation", info?.designation || "—"],
    ["Employee number", info?.employee_number || "—"],
    ["Joined school", info?.date_of_joining_school ? formatDate(info.date_of_joining_school) : "—"],
  ];

  return (
    <div className="portal-main">
      <h1 className="t-page-title">My Profile</h1>

      <div className="portal-panel">
        <h2>Your details</h2>
        {loading ? (
          <div className="skeleton" style={{ height: 140 }} />
        ) : (
          <div className="t-info">
            {rows.map(([k, v]) => (
              <div key={k} className="t-info-row"><span>{k}</span><strong>{v}</strong></div>
            ))}
          </div>
        )}
        <p className="t-hint">Name, subject and designation are set by the school admin.</p>
      </div>

      {teacher && (
        <div className="portal-panel" style={{ maxWidth: 560 }}>
          <h2>Contact details</h2>
          <form onSubmit={saveContact}>
            <div className="form-field">
              <label htmlFor="mobile">Mobile number</label>
              <input id="mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="emergency">Emergency contact</label>
              <input id="emergency" inputMode="tel" value={emergency} onChange={(e) => setEmergency(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="address">Current address</label>
              <textarea id="address" className="t-textarea" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingContact}>{savingContact ? "Saving…" : "Save contact details"}</button>
            {contactMsg && <p className={contactMsg.type === "success" ? "success-text" : "error-text"} role="status">{contactMsg.text}</p>}
          </form>
        </div>
      )}

      <div className="portal-panel" style={{ maxWidth: 560 }}>
        <h2>Change password</h2>
        <form onSubmit={changePassword}>
          <div className="form-field">
            <label htmlFor="cur_pw">Current password</label>
            <input id="cur_pw" type={showPw ? "text" : "password"} autoComplete="current-password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="new_pw">New password</label>
            <div className="auth-input-wrap">
              <input id="new_pw" type={showPw ? "text" : "password"} autoComplete="new-password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <button type="button" className="auth-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide passwords" : "Show passwords"}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="conf_pw">Confirm new password</label>
            <input id="conf_pw" type={showPw ? "text" : "password"} autoComplete="new-password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={savingPw}>{savingPw ? "Changing…" : "Change password"}</button>
          {pwMsg && <p className={pwMsg.type === "success" ? "success-text" : "error-text"} role="status">{pwMsg.text}</p>}
        </form>
      </div>
    </div>
  );
}
