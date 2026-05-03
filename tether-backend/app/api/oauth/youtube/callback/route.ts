import { NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";
import {
  exchangeCodeForTokens,
  getChannelStats,
  verifySignedState,
} from "@/lib/youtube";
import { encrypt } from "@/lib/encryption";
import { platforms, FRONTEND_URL } from "@/lib/config";

/**
 * GET /api/oauth/youtube/callback
 *
 * Google redirects here after the user grants (or denies) YouTube access.
 *
 * Since the frontend and backend are decoupled, there is no Supabase session
 * cookie present on this request. Instead, the user ID is recovered from the
 * HMAC-signed `state` parameter created by POST /api/oauth/youtube.
 *
 * On success:
 *   1. Verify the signed state → extract userId
 *   2. Exchange code for access + refresh tokens
 *   3. Fetch the user's YouTube channel info
 *   4. Encrypt both tokens and upsert into platform_tokens
 *   5. Redirect to FRONTEND_URL/dashboard?youtube_connected=true
 *
 * On error: redirect to FRONTEND_URL/dashboard?youtube_error=...
 */
export async function GET(req: Request) {
  const url         = new URL(req.url);
  const code        = url.searchParams.get("code");
  const state       = url.searchParams.get("state");
  const errorParam  = url.searchParams.get("error");
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;

  if (errorParam) {
    return NextResponse.redirect(
      `${dashboardUrl}?youtube_error=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${dashboardUrl}?youtube_error=missing_code`);
  }

  // 1. Verify the signed state — extracts userId without a session cookie
  const userId = verifySignedState(state);
  if (!userId) {
    return NextResponse.redirect(`${dashboardUrl}?youtube_error=invalid_or_expired_state`);
  }

  try {
    // 2. Exchange code → tokens
    const tokens = await exchangeCodeForTokens(code);

    // 3. Fetch the user's YouTube channel info
    const channel = await getChannelStats(tokens.access_token);

    // 4. Encrypt tokens before persisting
    const encryptedAccess  = encrypt(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const tokenExpiry      = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // 5. Upsert — reconnecting YouTube updates the existing row
    const { error: dbError } = await adminClient
      .from("platform_tokens")
      .upsert(
        {
          user_id:           userId,
          platform:          platforms.YOUTUBE,
          access_token:      encryptedAccess,
          refresh_token:     encryptedRefresh,
          token_expiry:      tokenExpiry,
          scope:             tokens.scope,
          platform_user_id:  channel.id,
          platform_username: channel.name,
          metadata: {
            handle:            channel.handle,
            thumbnail:         channel.thumbnail,
            uploadsPlaylistId: channel.uploadsPlaylistId,
          },
        },
        { onConflict: "user_id,platform" }
      );

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(`${dashboardUrl}?youtube_connected=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[youtube/callback] error:", msg);
    return NextResponse.redirect(
      `${dashboardUrl}?youtube_error=${encodeURIComponent(msg)}`
    );
  }
}
