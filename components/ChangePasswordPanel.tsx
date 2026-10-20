"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Lets a logged-in student or parent change their own password.
export default function ChangePasswordPanel() {
  const [open, setOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) return setMsg({ type: "error", text: "The new password must be at least 8 characters." });
    if (newPw !== confirmPw) return setMsg({ type: "error", text: "The new passwords don't match." });
    if (newPw === currentPw) return setMsg({ type: "error", text: "The new password must be different from the current one." });
    setSaving(true);
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email || "";
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (checkError) {
      setMsg({ type: "error", text: "Your current password is not correct." });
      setSaving(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) setMsg({ type: "error", text: error.message || "Could not change the password." });
    else {
      setMsg({ type: "success", text: "Password changed. Use the new one next time." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
    setSaving(false);
  }

  return (
    <div className="portal-panel no-print" style={{ marginTop: 22 }}>
      <div className="t-row-between">
        <h2 style={{ margin: 0 }}>Account</h2>
        <button className="btn btn-outline" onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Change password"}</button>
      </div>
      {open && (
        <form onSubmit={submit} style={{ marginTop: 14, maxWidth: 420 }}>
          <div className="form-field">
            <label htmlFor="cp_cur">Current password</label>
            <input id="cp_cur" type={show ? "text" : "password"} autoComplete="current-password" required value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="cp_new">New password</label>
            <div className="auth-input-wrap">
              <input id="cp_new" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
              <button type="button" className="auth-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passwords" : "Show passwords"}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="cp_conf">Confirm new password</label>
            <input id="cp_conf" type={show ? "text" : "password"} autoComplete="new-password" required value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Changing…" : "Change password"}</button>
          {msg && <p className={msg.type === "success" ? "success-text" : "error-text"} role="status">{msg.text}</p>}
        </form>
      )}
    </div>
  );
}
