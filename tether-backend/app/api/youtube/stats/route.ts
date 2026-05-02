import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { refreshAccessToken, getChannelStats, getRecentVideos } from "@/lib/youtube";
import { encrypt, decrypt } from "@/lib/encryption";
import { platforms } from "@/lib/config";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh when < 5 min remaining

/**
 * GET /api/youtube/stats
 *
 * Returns the authenticated user's YouTube channel stats + recent videos.
 *
 * 1. Verify Tether session
 * 2. Load encrypted tokens from platform_tokens
 * 3. Auto-refresh the access token if it expires within TOKEN_REFRESH_BUFFER_MS
 * 4. Fetch channel stats + recent videos from YouTube Data API v3
 * 5. Return structured JSON
 */
export async function GET() {
  // 1. Verify session
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Load tokens — admin client bypasses RLS for server-side reads
  const { data: row, error: dbError } = await adminClient
    .from("platform_tokens")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", platforms.YOUTUBE)
    .single();

  if (dbError || !row) {
    return NextResponse.json({ error: "YouTube not connected" }, { status: 404 });
  }

  // 3. Auto-refresh if expiring soon
  let accessToken = decrypt(row.access_token);
  const expiry = row.token_expiry ? new Date(row.token_expiry) : null;

  if (!expiry || expiry.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
    if (!row.refresh_token) {
      return NextResponse.json(
        { error: "Token expired and no refresh token available. Please reconnect YouTube." },
        { status: 401 }
      );
    }

    try {
      const refreshed = await refreshAccessToken(decrypt(row.refresh_token));
      accessToken = refreshed.access_token;

      await adminClient
        .from("platform_tokens")
        .update({
          access_token: encrypt(accessToken),
          token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("id", row.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Token refresh failed: ${msg}` }, { status: 401 });
    }
  }

  // 4. Fetch from YouTube Data API v3
  try {
    const uploadsPlaylistId = row.metadata?.uploadsPlaylistId as string | undefined;

    const [channel, videos] = await Promise.all([
      getChannelStats(accessToken),
      uploadsPlaylistId
        ? getRecentVideos(accessToken, uploadsPlaylistId)
        : Promise.resolve([]),
    ]);

    return NextResponse.json({ channel, videos, connectedAt: row.created_at });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[youtube/stats] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
