import { NextResponse } from "next/server";
import { getAuthUrl, createSignedState } from "@/lib/youtube";

/**
 * GET /api/oauth/youtube/debug
 *
 * Development-only endpoint — returns the YouTube OAuth URL that would be
 * generated for a dummy user, so you can paste it into a browser and see
 * exactly what Google says (redirect_uri_mismatch, access_denied, consent
 * screen, etc.) without needing a real session token.
 *
 * ⚠️  Remove this endpoint before launching to production, or guard it
 *    with `if (process.env.NODE_ENV !== "development") return 404`.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const state = createSignedState("debug-user-id");
  const url   = getAuthUrl(state);

  return NextResponse.json({
    oauth_url: url,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI ?? "http://127.0.0.1:3000/api/oauth/youtube/callback",
    client_id:    process.env.GOOGLE_CLIENT_ID?.slice(0, 20) + "…",
    instructions: [
      "1. Copy the oauth_url above and open it in your browser",
      "2. If you see 'Error 400: redirect_uri_mismatch' → the redirect URI is not registered in GCP",
      "3. If you see 'Error 403: access_denied'          → add your Gmail to GCP Test Users",
      "4. If you see the Google sign-in page              → proceed to sign in",
      "5. After sign-in, you should be redirected to the dashboard with ?youtube_connected=true",
    ],
  });
}
