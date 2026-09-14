"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Supabase automatically reads the reset token from the URL and creates
    // a temporary session — we just need to wait a moment for that to happen.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setHasSession(true);
      setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setReady(true);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

    if (updateError) {
      setError("Couldn't update the password. The reset link may have expired — request a new one.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => router.push("/login"), 2500);
  }

  if (!ready) {
    return <div className="loading-shell">Loading&hellip;</div>;
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Set a New Password</h1>
        <p style={{ fontSize: "0.87rem", color: "var(--muted)", marginBottom: "22px" }}>
          Government Boys High School, P.H. Pilot, Dadu
        </p>

        {!hasSession ? (
          <p className="error-text">
            This reset link is invalid or has expired. Please request a new one from the login page.
          </p>
        ) : success ? (
          <p className="success-text">Password updated. Redirecting you to login&hellip;</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="new_password">New password</label>
              <input id="new_password" type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="confirm_password">Confirm new password</label>
              <input id="confirm_password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Saving…" : "Set New Password"}
            </button>
            {error && <p className="error-text">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
