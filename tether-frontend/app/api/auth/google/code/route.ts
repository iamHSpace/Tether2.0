import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/auth/google/code
 *
 * Standard OAuth2 authorization-code callback.  Google redirects here with
 * `?code=…` after the user selects their Google account.
 *
 * Because we registered THIS URL (statvora.in) as the redirect_uri in Google
 * Cloud Console, the Google consent screen shows "to continue to statvora.in"
 * instead of the Supabase project URL — which is what the user sees.
 *
 * Steps:
 *   1. Exchange the code for an ID token via Google's token endpoint
 *      (requires GOOGLE_CLIENT_SECRET, kept server-side only)
 *   2. Exchange the ID token for a Supabase session (signInWithIdToken)
 *   3. Stamp session cookies onto the redirect response
 *   4. Send the user to /auth/google/complete for role-based routing
 */
export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  // Use the canonical (non-www) origin — must match the redirect_uri sent in
  // the authorization request and the URI registered in Google Cloud Console.
  const origin = `${url.protocol}//${url.host.replace(/^www\./, "")}`;

  const code  = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`
    );
  }
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  /* ── 1. Exchange authorization code for Google tokens ───────────────── */
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${origin}/api/auth/google/code`,
      grant_type:    "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.id_token) {
    const msg = tokenData.error_description ?? tokenData.error ?? "token_exchange_failed";
    console.error("[google/code] token exchange failed:", msg);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(msg)}`
    );
  }

  /* ── 2. Exchange ID token for a Supabase session ────────────────────── */
  const cookieStore = await cookies();
  const response    = NextResponse.redirect(`${origin}/auth/google/complete`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2]
            );
          });
        },
      },
    }
  );

  const { error: authErr } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: tokenData.id_token,
  });

  if (authErr) {
    console.error("[google/code] signInWithIdToken error:", authErr.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authErr.message)}`
    );
  }

  return response;
}
