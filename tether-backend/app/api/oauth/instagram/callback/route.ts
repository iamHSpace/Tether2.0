import { NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";
import {
  verifySignedState,
  exchangeCodeForTokens,
  getLongLivedToken,
  getInstagramAccount,
} from "@/lib/instagram";
import { encrypt } from "@/lib/encryption";
import { platforms, FRONTEND_URL } from "@/lib/config";

/**
 * GET /api/oauth/instagram/callback
 *
 * Facebook redirects here after the user grants (or denies) Instagram access.
 *
 * On success:
 *   1. Verify signed state → extract userId
 *   2. Exchange short-lived code for access token
 *   3. Upgrade to long-lived (60-day) token
 *   4. Resolve linked Instagram business account
 *   5. Encrypt token and upsert into platform_tokens
 *   6. Redirect to frontend /dashboard?instagram_connected=true
 *
 * On error: redirect to /dashboard?instagram_error=...
 */
export async function GET(req: Request) {
  const url          = new URL(req.url);
  const code         = url.searchParams.get("code");
  const state        = url.searchParams.get("state");
  const errorParam   = url.searchParams.get("error");
  const dashboardUrl = `${FRONTEND_URL}/dashboard`;

  if (errorParam) {
    return NextResponse.redirect(
      `${dashboardUrl}?instagram_error=${encodeURIComponent(url.searchParams.get("error_description") ?? errorParam)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${dashboardUrl}?instagram_error=missing_code`);
  }

  const userId = verifySignedState(state);
  if (!userId) {
    return NextResponse.redirect(`${dashboardUrl}?instagram_error=invalid_or_expired_state`);
  }

  try {
    // Short-lived user token
    const { access_token: shortToken } = await exchangeCodeForTokens(code);

    // Upgrade to long-lived token (valid ~60 days)
    const { access_token: longToken, expires_in } = await getLongLivedToken(shortToken);

    // Resolve Instagram business account
    const account = await getInstagramAccount(longToken);

    const encryptedToken = encrypt(longToken);
    const tokenExpiry    = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: dbError } = await adminClient
      .from("platform_tokens")
      .upsert(
        {
          user_id:           userId,
          platform:          platforms.INSTAGRAM,
          access_token:      encryptedToken,
          refresh_token:     null,
          token_expiry:      tokenExpiry,
          scope:             "instagram_basic,pages_read_engagement",
          platform_user_id:  account.id,
          platform_username: account.name,
          metadata: {
            username:            account.username,
            followers_count:     account.followers_count,
            media_count:         account.media_count,
            profile_picture_url: account.profile_picture_url,
          },
        },
        { onConflict: "user_id,platform" }
      );

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(`${dashboardUrl}?instagram_connected=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[instagram/callback] error:", msg);
    return NextResponse.redirect(
      `${dashboardUrl}?instagram_error=${encodeURIComponent(msg)}`
    );
  }
}
