"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";
import { routes } from "@/lib/config";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);

    try {
      // signInWithOAuth with PKCE makes a real network request to Supabase
      // to get the Google OAuth URL. It throws (not returns) a non-AuthError
      // on network failure, so the whole call must be wrapped in try/catch.
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          // skipBrowserRedirect: true — we control navigation ourselves so
          // errors can be caught and displayed rather than failing silently.
          skipBrowserRedirect: true,
          redirectTo: routes.authCallback,
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!data?.url) {
        setError(
          "Supabase returned no OAuth URL. " +
          "Make sure local Supabase is running (`supabase start`) " +
          "and Google is enabled in supabase/config.toml."
        );
        setLoading(false);
        return;
      }

      // Navigate to Google's consent screen.
      // Keep loading=true — the page is navigating away.
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // "Failed to fetch" → local Supabase is not running
      if (msg.toLowerCase().includes("failed to fetch")) {
        setError(
          `Cannot reach Supabase at ${process.env.NEXT_PUBLIC_SUPABASE_URL}. ` +
          "Run `supabase start` in your project directory first."
        );
      } else {
        setError(msg);
      }

      setLoading(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>
        Sign in to Tether
      </h1>

      {error && (
        <p
          style={{
            color: "#c00",
            background: "#fff0f0",
            padding: "0.75rem 1rem",
            borderRadius: 6,
            border: "1px solid #fcc",
            maxWidth: 420,
            textAlign: "center",
            lineHeight: 1.5,
          }}
        >
          {error}
        </p>
      )}

      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        style={{
          padding: "0.7rem 1.75rem",
          fontSize: "1rem",
          background: loading ? "#ccc" : "#4285F4",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      >
        {loading ? "Opening Google…" : "Continue with Google"}
      </button>
    </main>
  );
}
