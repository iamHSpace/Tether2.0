"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/app/actions/auth";

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-all duration-150 disabled:opacity-50 mb-5"
    >
      <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.859-3.048.859-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"/>
        <path fill="#FBBC05" d="M3.964 10.705A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.705V4.963H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.037l3.007-2.332Z"/>
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.963L3.964 7.295C4.672 5.169 6.656 3.58 9 3.58Z"/>
      </svg>
      {pending ? "Redirecting…" : "Continue with Google"}
    </button>
  );
}

export default function LoginPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setError(error.message); setLoading(false); return; }
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your Tether account</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Google — uses a server action form so the PKCE verifier is
              stored in server-set cookies, not document.cookie */}
          <form action={signInWithGoogle}>
            <GoogleButton />
          </form>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                disabled={loading} placeholder="you@example.com"
                className="input"
              />
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
              {loading ? "Signing in…" : "Sign in"}
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
