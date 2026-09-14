"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !data.user) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile?.role) {
      setError(
        "Your account doesn't have a portal role set up yet. Ask the school admin to check your account."
      );
      setLoading(false);
      return;
    }

    router.push(`/${profile.role}`);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <h1 style={{ fontSize: "1.4rem", marginBottom: "4px" }}>Portal Login</h1>
        <p style={{ fontSize: "0.87rem", color: "var(--muted)", marginBottom: "22px" }}>
          Government Boys High School, P.H. Pilot, Dadu
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>
          {error && <p className="error-text">{error}</p>}
          <p style={{ fontSize: "0.8rem", marginTop: "14px" }}>
            <Link href="/forgot-password" style={{ color: "var(--accent-2)" }}>Forgot your password?</Link>
          </p>
        </form>
        <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "20px" }}>
          Don't have an account? Ask the school office &mdash; accounts are created by the admin, not self-registered.
        </p>
      </div>
    </div>
  );
}
