/**
 * Edge Function: daily-snapshot
 *
 * Runs once per day (scheduled via pg_cron → pg_net).
 * For every user with a connected YouTube account:
 *   1. Decrypt their stored access token
 *   2. Auto-refresh if expiring within 10 minutes
 *   3. Fetch channel stats + recent videos from YouTube Data API v3
 *   4. Insert a row into metric_snapshots
 *
 * Authentication: caller must supply the CRON_SECRET as a Bearer token.
 * This prevents the endpoint being triggered by arbitrary HTTP requests.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Helpers: hex ──────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── AES-256-GCM (mirrors lib/encryption.ts) ──────────────────────────────────
// Key = SHA-256(ENCRYPTION_SECRET), format = iv_hex:authTag_hex:ciphertext_hex

async function deriveKey(secret: string, usage: "encrypt" | "decrypt"): Promise<CryptoKey> {
  const keyBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [usage]);
}

async function decrypt(stored: string, secret: string): Promise<string> {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  const iv         = hexToBytes(ivHex);
  const authTag    = hexToBytes(authTagHex);
  const ciphertext = hexToBytes(ciphertextHex);

  // Web Crypto AES-GCM expects the auth tag appended to the ciphertext
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);

  const key = await deriveKey(secret, "decrypt");
  const plainBytes = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    combined
  );
  return new TextDecoder().decode(plainBytes);
}

async function encrypt(plaintext: string, secret: string): Promise<string> {
  const iv  = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secret, "encrypt");

  const result = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Web Crypto appends the 16-byte auth tag to the ciphertext
  const resultBytes = new Uint8Array(result);
  const ciphertext  = resultBytes.slice(0, -16);
  const authTag     = resultBytes.slice(-16);

  return `${bytesToHex(iv)}:${bytesToHex(authTag)}:${bytesToHex(ciphertext)}`;
}

// ── YouTube token refresh ─────────────────────────────────────────────────────

async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     Deno.env.get("GOOGLE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description ?? data.error ?? "Token refresh failed");
  return data;
}

// ── YouTube Data API v3 ───────────────────────────────────────────────────────

const YT_API = "https://www.googleapis.com/youtube/v3";

async function fetchChannelStats(accessToken: string) {
  const res = await fetch(
    `${YT_API}/channels?part=snippet,statistics,contentDetails&mine=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await res.json();
  if (!res.ok || !data.items?.length) {
    throw new Error(data.error?.message ?? "No YouTube channel found");
  }
  const ch = data.items[0];
  return {
    id:                ch.id,
    name:              ch.snippet.title,
    handle:            ch.snippet.customUrl ?? "",
    thumbnail:         ch.snippet.thumbnails?.default?.url ?? "",
    subscribers:       parseInt(ch.statistics.subscriberCount  ?? "0", 10),
    totalViews:        parseInt(ch.statistics.viewCount         ?? "0", 10),
    videoCount:        parseInt(ch.statistics.videoCount        ?? "0", 10),
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}

async function fetchRecentVideos(accessToken: string, uploadsPlaylistId: string) {
  const plRes = await fetch(
    `${YT_API}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=5`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const plData = await plRes.json();
  if (!plRes.ok) throw new Error(plData.error?.message ?? "Playlist fetch failed");

  const ids: string[] = (plData.items ?? []).map(
    (i: { contentDetails: { videoId: string } }) => i.contentDetails.videoId
  );
  if (!ids.length) return [];

  const vRes = await fetch(
    `${YT_API}/videos?part=snippet,statistics&id=${ids.join(",")}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const vData = await vRes.json();
  if (!vRes.ok) throw new Error(vData.error?.message ?? "Videos fetch failed");

  return (vData.items ?? []).map((v: {
    id: string;
    snippet: { title: string; thumbnails: { medium: { url: string } }; publishedAt: string };
    statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
  }) => ({
    id:          v.id,
    title:       v.snippet.title,
    thumbnail:   v.snippet.thumbnails?.medium?.url ?? "",
    publishedAt: v.snippet.publishedAt,
    views:       parseInt(v.statistics.viewCount    ?? "0", 10),
    likes:       parseInt(v.statistics.likeCount    ?? "0", 10),
    comments:    parseInt(v.statistics.commentCount ?? "0", 10),
  }));
}

// ── Main handler ──────────────────────────────────────────────────────────────

const TOKEN_REFRESH_BUFFER_MS = 10 * 60 * 1000; // refresh when < 10 min remaining

Deno.serve(async (req) => {
  // Verify this was called by the cron job, not a random request
  const cronSecret = Deno.env.get("CRON_SECRET");
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encryptionSecret = Deno.env.get("ENCRYPTION_SECRET")!;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Load every connected YouTube account
  const { data: tokens, error: tokensError } = await supabase
    .from("platform_tokens")
    .select("id, user_id, access_token, refresh_token, token_expiry, metadata")
    .eq("platform", "youtube");

  if (tokensError) {
    console.error("Failed to load platform_tokens:", tokensError.message);
    return Response.json({ error: tokensError.message }, { status: 500 });
  }

  let succeeded = 0;
  let failed    = 0;
  const errors: string[] = [];

  for (const row of tokens ?? []) {
    try {
      let accessToken = await decrypt(row.access_token, encryptionSecret);

      // Auto-refresh if token is expiring soon
      const expiry = row.token_expiry ? new Date(row.token_expiry) : null;
      if (!expiry || expiry.getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS) {
        if (!row.refresh_token) {
          throw new Error("Token expired and no refresh token — user must reconnect");
        }
        const decryptedRefresh = await decrypt(row.refresh_token, encryptionSecret);
        const refreshed = await refreshAccessToken(decryptedRefresh);
        accessToken = refreshed.access_token;

        // Persist the new access token
        await supabase
          .from("platform_tokens")
          .update({
            access_token: await encrypt(accessToken, encryptionSecret),
            token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
          })
          .eq("id", row.id);
      }

      // Fetch stats from YouTube
      const uploadsPlaylistId = (row.metadata as Record<string, string>)?.uploadsPlaylistId;
      const [channel, videos] = await Promise.all([
        fetchChannelStats(accessToken),
        uploadsPlaylistId ? fetchRecentVideos(accessToken, uploadsPlaylistId) : Promise.resolve([]),
      ]);

      // Store snapshot
      const { error: insertError } = await supabase
        .from("metric_snapshots")
        .insert({
          user_id:  row.user_id,
          platform: "youtube",
          data:     { channel, videos },
        });

      if (insertError) throw new Error(`DB insert failed: ${insertError.message}`);

      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[daily-snapshot] user ${row.user_id} failed:`, msg);
      errors.push(`${row.user_id}: ${msg}`);
      failed++;
    }
  }

  console.log(`[daily-snapshot] done — ${succeeded} succeeded, ${failed} failed`);
  return Response.json({
    succeeded,
    failed,
    total: (tokens ?? []).length,
    ...(errors.length ? { errors } : {}),
  });
});
