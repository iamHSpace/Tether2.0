"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

const GOOGLE_SVG = (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
    <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z"/>
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.169 6.656 3.58 9 3.58Z"/>
  </svg>
);

type UserType = "creator" | "business";

export default function LoginPage() {
  const [userType, setUserType]     = useState<UserType>("creator");
  const [identifier, setIdentifier] = useState("");   // email or username
  const [password, setPassword]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const urlError =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const raw = identifier.trim().toLowerCase();

    // Resolve username → email if needed
    let email = raw;
    if (!raw.includes("@")) {
      try {
        const res = await fetch(`${BACKEND}/api/auth/resolve-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: raw }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? "Username not found"); setLoading(false); return; }
        email = data.email;
      } catch {
        setError("Could not connect to server"); setLoading(false); return;
      }
    }

    const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) { setError(authErr.message); setLoading(false); return; }

    // Middleware routes to the correct home based on user_type in JWT
    window.location.href = userType === "business" ? "/discover" : "/dashboard";
  }

  async function handleGoogleLogin() {
    setLoading(true); setError(null);
    localStorage.setItem("tether_intended_user_type", userType);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  const isCreator = userType === "creator";
  // Detect whether the user is typing an email or username for the placeholder
  const looksLikeEmail = identifier.includes("@");

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isCreator ? "Sign in to your creator account" : "Sign in to your business account"}
          </p>
        </div>

        <div className="card p-8">
          {/* Role toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl mb-6">
            <button type="button" onClick={() => setUserType("creator")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                isCreator ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={isCreator ? "#7c3aed" : "currentColor"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23,7 16,12 23,17 23,7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              Creator
            </button>
            <button type="button" onClick={() => setUserType("business")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !isCreator ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={!isCreator ? "#2563eb" : "currentColor"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              Business
            </button>
          </div>

          {(error ?? urlError) && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              {error ?? urlError}
            </div>
          )}

          <button onClick={handleGoogleLogin} disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all duration-150 mb-5 disabled:opacity-50">
            {GOOGLE_SVG}
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or sign in with email / username</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email or username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                disabled={loading}
                placeholder="you@example.com or yourhandle"
                className="input"
              />
              {identifier && !looksLikeEmail && (
                <p className="mt-1 text-xs text-gray-400">Signing in with username</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Password</label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                disabled={loading} placeholder="••••••••"
                className="input"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-1 py-3 text-sm">
              {loading ? "Signing in…" : `Sign in as ${isCreator ? "Creator" : "Business"}`}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-brand-600 font-medium hover:text-brand-700">Create one free</a>
          </p>
        </div>
      </div>
    </div>
  );
}
