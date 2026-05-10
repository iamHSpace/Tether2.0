"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;


const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.169 6.656 3.58 9 3.58Z"/>
  </svg>
);

type UserType = "creator" | "business";

export default function SignupPage() {
  const [step, setStep]         = useState<"type" | "form">("type");
  const [userType, setUserType] = useState<UserType>("creator");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [company, setCompany]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [done, setDone]         = useState(false);
  const [gisReady, setGisReady] = useState(false);

  const googleBtnRef = useRef<HTMLDivElement>(null);

  function pickType(type: UserType) {
    setUserType(type);
    setStep("form");
  }

  // ── Keep localStorage in sync so the callback page knows the intended role ───
  useEffect(() => {
    if (step !== "form") return;
    localStorage.setItem("_pending_user_type", userType);
    if (userType === "business") {
      localStorage.setItem("_pending_company", company);
    } else {
      localStorage.removeItem("_pending_company");
    }
  }, [step, userType, company]);

  // ── Load GIS ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setGisReady(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!gisReady || !googleBtnRef.current) return;
    // Redirect mode: full-page redirect through Google, credential POSTed to
    // our server — no popup, works in all browsers including Brave.
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      ux_mode: "redirect",
      login_uri: `${window.location.origin}/api/auth/google/callback`,
      auto_select: false,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: googleBtnRef.current.parentElement?.offsetWidth ?? 400,
      logo_alignment: "center",
    });
  }, [gisReady]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords don't match."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }

    setLoading(true); setError(null);

    const metadata: Record<string, string> = { user_type: userType };
    if (userType === "business" && company.trim()) {
      metadata.company_name = company.trim();
    }

    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: metadata },
    });

    if (signupError) { setError(signupError.message); setLoading(false); return; }

    if (data.session) {
      window.location.href = userType === "business" ? "/discover" : "/onboarding";
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  // ── Type selection ────────────────────────────────────────────────────────────

  if (step === "type") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
              <img src="/brand/logo-icon.svg" width={24} height={24} alt="Statvora" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Join Statvora</h1>
            <p className="text-gray-500 text-sm mt-1">Who are you signing up as?</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => pickType("creator")}
              className="card p-6 text-left hover:border-brand-300 hover:shadow-card-hover transition-all duration-150 border-2 border-transparent">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Creator</h3>
              <p className="text-xs text-gray-500 leading-relaxed">I create content and want to showcase my verified metrics to brands.</p>
            </button>
            <button onClick={() => pickType("business")}
              className="card p-6 text-left hover:border-brand-300 hover:shadow-card-hover transition-all duration-150 border-2 border-transparent">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Business</h3>
              <p className="text-xs text-gray-500 leading-relaxed">I&apos;m a marketing manager or agency looking for verified creators to partner with.</p>
            </button>
          </div>
          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Email confirmation sent ────────────────────────────────────────────────────

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="card p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">✉️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your inbox</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.
          </p>
          <a href="/login" className="inline-block mt-6 text-brand-600 text-sm font-medium hover:text-brand-700">
            Back to sign in →
          </a>
        </div>
      </div>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────────

  const isCreator = userType === "creator";

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Join Statvora</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isCreator ? "Your verified creator profile starts here" : "Find and connect with verified creators"}
          </p>
          {/* Selected role badge + back link */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
              isCreator
                ? "bg-purple-50 text-purple-700 border border-purple-100"
                : "bg-blue-50 text-blue-700 border border-blue-100"
            }`}>
              {isCreator ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
              )}
              {isCreator ? "Creator account" : "Business account"}
            </span>
            <button onClick={() => setStep("type")} className="text-xs text-gray-400 hover:text-brand-600 font-medium">
              Change
            </button>
          </div>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Google button — GIS popup, no redirect */}
          <div className="relative w-full mb-5 rounded-xl overflow-hidden" style={{ height: 48 }}>
            <div className="absolute inset-0 flex items-center justify-center gap-3 px-4 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 pointer-events-none">
              {GOOGLE_SVG}
              {loading ? "Signing in…" : "Sign up with Google"}
            </div>
            <div
              ref={googleBtnRef}
              className="absolute inset-0 overflow-hidden"
              style={{ opacity: gisReady ? 0.01 : 0 }}
            />
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or with email</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {!isCreator && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Company name</label>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                  disabled={loading} placeholder="Acme Marketing" className="input" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading} placeholder="you@example.com" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" required minLength={6} value={password}
                onChange={e => setPassword(e.target.value)} disabled={loading}
                placeholder="Min. 6 characters" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <input type="password" required value={confirm}
                onChange={e => setConfirm(e.target.value)} disabled={loading}
                placeholder="••••••••"
                className={`input ${confirm && confirm !== password ? "border-red-300 focus:ring-red-400" : ""}`} />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm mt-1">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</a>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
