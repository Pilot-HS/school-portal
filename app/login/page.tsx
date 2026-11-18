"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ClipboardCheck, BookOpen, Award } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Turns the technical sign-in error into a plain sentence that says what to do.
function friendlyLoginError(err: any): string {
  const msg = String(err?.message || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  const name = String(err?.name || "");
  const status = Number(err?.status || 0);

  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "Your account hasn't been confirmed yet. Please ask the school office to confirm it.";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Check how your email is spelled and that Caps Lock is off, then try again. If you have forgotten your password, use the link below.";
  }
  if (status === 429 || code.includes("rate_limit") || msg.includes("too many") || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (code === "user_banned" || msg.includes("banned") || msg.includes("disabled")) {
    return "This account has been switched off. Please contact the school office.";
  }
  if (name === "AuthRetryableFetchError" || msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch") || status === 0 || status >= 500) {
    return "We couldn't reach the school server. Check your internet connection and try again in a minute. If it keeps happening, tell the school office.";
  }
  return `Sign-in didn't work (${err?.message || "unknown reason"}). Please try again, or ask the school office.`;
}

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

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError || !data.user) {
        setError(friendlyLoginError(signInError));
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
          "You signed in, but your account doesn't have a portal role yet. Please ask the school admin to set it up."
        );
        setLoading(false);
        return;
      }

      router.push(`/${profile.role}`);
    } catch (err) {
      setError(friendlyLoginError(err));
      setLoading(false);
    }
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
