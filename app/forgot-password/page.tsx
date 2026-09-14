"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (resetError) {
      setError("Something went wrong sending the reset email. Please try again.");
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Reset Password</h1>
        <p style={{ fontSize: "0.87rem", color: "var(--muted)", marginBottom: "22px" }}>
          Government Boys High School, P.H. Pilot, Dadu
        </p>

        {sent ? (
          <div>
            <p className="success-text" style={{ marginTop: 0 }}>
              If an account exists for {email}, a password reset link has been sent. Check the inbox (and spam folder) and follow the link.
            </p>
            <Link href="/login" style={{ fontSize: "0.85rem", color: "var(--accent-2)" }}>&larr; Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Your login email</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            {error && <p className="error-text">{error}</p>}
            <p style={{ fontSize: "0.8rem", marginTop: "18px" }}>
              <Link href="/login" style={{ color: "var(--accent-2)" }}>&larr; Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
