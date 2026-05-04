"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.169 6.656 3.58 9 3.58Z"/>
  </svg>
);

export default function SignupPage() {
  const [step, setStep]         = useState<"type" | "form">("type");
  const [userType, setUserType] = useState<"creator" | "business" | null>(null);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  function selectType(type: "creator" | "business") {
    setUserType(type);
    if (type === "creator") {
      // Redirect to the creator platform
      window.location.href = `${process.env.NEXT_PUBLIC_CREATOR_URL ?? "https://tether-frontend.vercel.app"}/signup`;
      return;
    }
    setStep("form");
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (signupError) { setError(signupError.message); setLoading(false); return; }
    if (data.session) {
      // Mark as business user and set company name
      try {
        await api.profile.update({ user_type: "business", full_name: company.trim() || null });
      } catch { /* non-fatal */ }
      window.location.href = "/dashboard";
    } else {
      setError("Check your email to confirm your account, then sign in.");
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) { setError(error.message); setLoading(false); }
    // After Google OAuth, /dashboard will call api.profile.update({ user_type: 'business' })
    // via the onboarding check
  }

  if (step === "type") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <a href="/" className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
            <h1 className="text-2xl font-bold text-gray-900">Join Tether</h1>
            <p className="text-gray-500 text-sm mt-1">Who are you signing up as?</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => selectType("creator")}
              className="card p-6 text-left hover:border-brand-300 hover:shadow-card-hover transition-all duration-150 group border-2 border-transparent">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:bg-brand-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Creator</h3>
              <p className="text-xs text-gray-500 leading-relaxed">I create content and want to showcase my verified metrics to brands.</p>
            </button>

            <button onClick={() => selectType("business")}
              className="card p-6 text-left hover:border-brand-300 hover:shadow-card-hover transition-all duration-150 group border-2 border-transparent">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-brand-100">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <a href="/" className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
          <h1 className="text-2xl font-bold text-gray-900">Create your business account</h1>
          <p className="text-gray-500 text-sm mt-1">Discover and save verified creators</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}

          <button onClick={handleGoogleSignup} disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all mb-5 disabled:opacity-50">
            {GOOGLE_SVG}
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleEmailSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Company / Agency name</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                disabled={loading} placeholder="Acme Marketing" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Work email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading} placeholder="you@company.com" className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                disabled={loading} placeholder="Min. 8 characters" className="input" />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-sm">
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <a href="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</a>
          </p>
          <button onClick={() => setStep("type")} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-3">
            ← Change account type
          </button>
        </div>
      </div>
    </div>
  );
}
