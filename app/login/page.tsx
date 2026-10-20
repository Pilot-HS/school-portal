"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ClipboardCheck, BookOpen, Award } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
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
    <div className="auth-page">
      <div className="auth-brand">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="auth-mark">G</div>
          <h2>Government Boys High School, P.H. Pilot, Dadu</h2>
          <p className="auth-tagline">Learning Today, Leading Tomorrow</p>
          <ul className="auth-points">
            <li>
              <span className="pt-icon"><ClipboardCheck size={17} /></span>
              Attendance and timetables, always up to date
            </li>
            <li>
              <span className="pt-icon"><BookOpen size={17} /></span>
              Homework and notices in one place
            </li>
            <li>
              <span className="pt-icon"><Award size={17} /></span>
              Exam results and progress at a glance
            </li>
          </ul>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-box">
          <h1>Welcome back</h1>
          <p className="auth-sub">Sign in to your school portal.</p>

          <form onSubmit={handleSubmit}>
            <div className="form-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="auth-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Signing in…" : "Log In"}
            </button>

            {error && <div className="auth-error" role="alert">{error}</div>}

            <p style={{ marginTop: "16px", marginBottom: 0 }}>
              <Link href="/forgot-password" className="auth-link">Forgot your password?</Link>
            </p>
          </form>

          <p style={{ marginTop: "18px", marginBottom: 0 }}>
            <a href="https://pilot-hs.github.io/School-Website/" className="auth-link">&larr; Back to the school website</a>
          </p>

          <p className="auth-foot">
            Don&apos;t have an account? Ask the school office &mdash; accounts are created by the admin, not self-registered.
          </p>
        </div>
      </div>
    </div>
  );
}
