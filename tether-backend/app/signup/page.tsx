"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { routes } from "@/lib/config";

type LoadingState = "idle" | "email" | "google";

export default function SignupPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [loading, setLoading]         = useState<LoadingState>("idle");
  const [error, setError]             = useState<string | null>(null);
  const [success, setSuccess]         = useState(false);

  // ── Email / Password sign-up ──────────────────────────────────────────────
  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    if (loading !== "idle") return;

    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading("email");

    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
      setLoading("idle");
      return;
    }

    // If email confirmation is disabled (local dev default), the user is
    // immediately signed in and a session is returned — redirect to dashboard.
    // If confirmation is required, data.session is null — show a message.
    if (data.session) {
      window.location.href = routes.home;
    } else {
      setSuccess(true);
      setLoading("idle");
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────
  async function handleGoogleLogin() {
    if (loading !== "idle") return;

    setLoading("google");
    setError(null);

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          redirectTo: routes.authCallback,
        },
      });

      if (error) {
        setError(error.message);
        setLoading("idle");
        return;
      }

      if (!data?.url) {
        setError(
          "Supabase returned no OAuth URL. " +
          "Make sure local Supabase is running (`supabase start`) " +
          "and Google is enabled in supabase/config.toml."
        );
        setLoading("idle");
        return;
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.toLowerCase().includes("failed to fetch")
          ? `Cannot reach Supabase at ${process.env.NEXT_PUBLIC_SUPABASE_URL}. Run \`supabase start\` first.`
          : msg
      );
      setLoading("idle");
    }
  }

  const busy = loading !== "idle";

  // ── Confirmation state ────────────────────────────────────────────────────
  if (success) {
    return (
      <main style={s.page}>
        <div style={s.card}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✉️</div>
            <h2 style={{ margin: "0 0 0.5rem", color: "#0f172a" }}>Check your email</h2>
            <p style={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your
              account, then{" "}
              <a href={routes.login} style={s.link}>
                sign in
              </a>
              .
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        {/* Logo / title */}
        <div style={s.header}>
          <h1 style={s.title}>Tether</h1>
          <p style={s.subtitle}>Create your account</p>
        </div>

        {/* Error banner */}
        {error && <div style={s.errorBanner}>{error}</div>}

        {/* Email / password form */}
        <form onSubmit={handleEmailSignup} style={s.form}>
          <div style={s.field}>
            <label style={s.label} htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              style={s.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              style={s.input}
              placeholder="Min. 6 characters"
            />
          </div>

          <div style={s.field}>
            <label style={s.label} htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
              style={{
                ...s.input,
                borderColor:
                  confirm && confirm !== password ? "#fc8181" : undefined,
              }}
              placeholder="••••••••"
            />
            {confirm && confirm !== password && (
              <span style={{ fontSize: "0.78rem", color: "#e53e3e", marginTop: 2 }}>
                Passwords don&apos;t match
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{ ...s.btn, ...s.primaryBtn, ...(busy ? s.btnDisabled : {}) }}
          >
            {loading === "email" ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Divider */}
        <div style={s.divider}>
          <span style={s.dividerLine} />
          <span style={s.dividerText}>or</span>
          <span style={s.dividerLine} />
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleLogin}
          disabled={busy}
          style={{ ...s.btn, ...s.googleBtn, ...(busy ? s.btnDisabled : {}) }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
            <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.169 6.656 3.58 9 3.58Z"/>
          </svg>
          {loading === "google" ? "Opening Google…" : "Continue with Google"}
        </button>

        {/* Sign-in link */}
        <p style={s.footerText}>
          Already have an account?{" "}
          <a href={routes.login} style={s.link}>Sign in</a>
        </p>
      </div>
    </main>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "#f7f8fa",
    padding: "1rem",
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    padding: "2.5rem 2rem",
    width: "100%",
    maxWidth: 400,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
  },
  header: {
    textAlign: "center",
    marginBottom: "1.75rem",
  },
  title: {
    margin: 0,
    fontSize: "1.75rem",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: "#0f172a",
  },
  subtitle: {
    margin: "0.35rem 0 0",
    fontSize: "0.9rem",
    color: "#64748b",
  },
  errorBanner: {
    background: "#fff5f5",
    border: "1px solid #fed7d7",
    borderRadius: 6,
    padding: "0.75rem 1rem",
    marginBottom: "1.25rem",
    color: "#c53030",
    fontSize: "0.875rem",
    lineHeight: 1.5,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  label: {
    fontSize: "0.85rem",
    fontWeight: 500,
    color: "#374151",
  },
  input: {
    padding: "0.6rem 0.75rem",
    fontSize: "0.95rem",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    outline: "none",
    color: "#0f172a",
    background: "#fff",
    transition: "border-color 0.15s",
  },
  btn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.6rem",
    width: "100%",
    padding: "0.65rem 1rem",
    fontSize: "0.95rem",
    fontWeight: 500,
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  primaryBtn: {
    background: "#0f172a",
    color: "#fff",
    marginTop: "0.25rem",
  },
  googleBtn: {
    background: "#fff",
    color: "#374151",
    border: "1px solid #d1d5db",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
  },
  btnDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    margin: "1.25rem 0",
  },
  dividerLine: {
    flex: 1,
    height: 1,
    background: "#e2e8f0",
    display: "block",
  },
  dividerText: {
    fontSize: "0.8rem",
    color: "#94a3b8",
    flexShrink: 0,
  },
  footerText: {
    textAlign: "center",
    fontSize: "0.875rem",
    color: "#64748b",
    marginTop: "1.5rem",
    marginBottom: 0,
  },
  link: {
    color: "#3b82f6",
    textDecoration: "none",
    fontWeight: 500,
  },
};
