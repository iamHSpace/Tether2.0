import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { exchangeCodeForTokens, getChannelStats } from "@/lib/youtube";
import { encrypt } from "@/lib/encryption";
import { routes, platforms } from "@/lib/config";

/**
 * GET /api/oauth/youtube/callback
 *
 * Google redirects here after the user grants (or denies) YouTube access.
 *
 * On success:
 *   1. Exchange code for access + refresh tokens
 *   2. Fetch the user's YouTube channel info
 *   3. Encrypt both tokens and upsert into platform_tokens
 *   4. Redirect to dashboard
 *
 * On error: redirect to dashboard with ?error=... so the UI can surface it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${routes.home}?youtube_error=${encodeURIComponent(errorParam)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${routes.home}?youtube_error=missing_code`);
  }

  // Verify the Tether session — we need user.id to associate the tokens
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${routes.login}?error=session_expired`);
  }

  try {
    // 1. Exchange code → tokens
    const tokens = await exchangeCodeForTokens(code);

    // 2. Fetch the user's YouTube channel info
    const channel = await getChannelStats(tokens.access_token);

    // 3. Encrypt tokens before persisting
    const encryptedAccess  = encrypt(tokens.access_token);
    const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
    const tokenExpiry      = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // 4. Upsert — reconnecting YouTube updates the existing row
    const { error: dbError } = await adminClient
      .from("platform_tokens")
      .upsert(
        {
          user_id:           user.id,
          platform:          platforms.YOUTUBE,
          access_token:      encryptedAccess,
          refresh_token:     encryptedRefresh,
          token_expiry:      tokenExpiry,
          scope:             tokens.scope,
          platform_user_id:  channel.id,
          platform_username: channel.name,
          metadata: {
            handle:             channel.handle,
            thumbnail:          channel.thumbnail,
            uploadsPlaylistId:  channel.uploadsPlaylistId,
          },
        },
        { onConflict: "user_id,platform" }
      );

    if (dbError) throw new Error(dbError.message);

    return NextResponse.redirect(`${routes.home}?youtube_connected=true`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[youtube/callback] error:", msg);
    return NextResponse.redirect(
      `${routes.home}?youtube_error=${encodeURIComponent(msg)}`
    );
  }
}
