/**
 * YouTube OAuth 2.0 + Data API v3 helpers.
 *
 * OAuth flow:
 *   1. getAuthUrl()              → send user to Google consent screen
 *   2. exchangeCodeForTokens()   → swap code for access + refresh tokens
 *   3. refreshAccessToken()      → get a new access token when expired
 *
 * Data:
 *   4. getChannelStats()         → channel snippet + statistics
 *   5. getRecentVideos()         → most-recent uploads with stats
 */

import { youtube as cfg, routes } from "@/lib/config";

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function getAuthUrl(): string {
  // YOUTUBE_REDIRECT_URI in .env.local overrides the default from config.
  // Useful when tunnelling (e.g. ngrok) without changing config.ts.
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ?? routes.youtubeCallback;

  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         cfg.scopes,
    access_type:   "offline",  // request a refresh token
    prompt:        "consent",  // always show consent so we always receive refresh_token
  });

  return `${cfg.authUrl}?${params.toString()}`;
}

export interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in:    number;  // seconds
  scope:         string;
  token_type:    string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ?? routes.youtubeCallback;

  const res = await fetch(cfg.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Token exchange failed");
  }
  return data as TokenResponse;
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(cfg.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type:    "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description ?? data.error ?? "Token refresh failed");
  }
  return data;
}

// ─── Data API v3 ──────────────────────────────────────────────────────────────

export interface ChannelStats {
  id:                  string;
  name:                string;
  handle:              string;  // e.g. @MyChannel
  thumbnail:           string;
  subscribers:         number;
  totalViews:          number;
  videoCount:          number;
  uploadsPlaylistId:   string;
}

export async function getChannelStats(accessToken: string): Promise<ChannelStats> {
  const url = `${cfg.apiBase}/channels?part=snippet,statistics,contentDetails&mine=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok || !data.items?.length) {
    throw new Error(data.error?.message ?? "No YouTube channel found for this account");
  }

  const ch = data.items[0];
  return {
    id:                ch.id,
    name:              ch.snippet.title,
    handle:            ch.snippet.customUrl ?? "",
    thumbnail:         ch.snippet.thumbnails?.default?.url ?? "",
    subscribers:       parseInt(ch.statistics.subscriberCount ?? "0", 10),
    totalViews:        parseInt(ch.statistics.viewCount ?? "0", 10),
    videoCount:        parseInt(ch.statistics.videoCount ?? "0", 10),
    uploadsPlaylistId: ch.contentDetails.relatedPlaylists.uploads,
  };
}

export interface VideoSummary {
  id:          string;
  title:       string;
  thumbnail:   string;
  publishedAt: string;
  views:       number;
  likes:       number;
  comments:    number;
}

export async function getRecentVideos(
  accessToken: string,
  uploadsPlaylistId: string,
  maxResults = cfg.maxRecentVideos
): Promise<VideoSummary[]> {
  // Step 1: get video IDs from the uploads playlist
  const plRes = await fetch(
    `${cfg.apiBase}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  const plData = await plRes.json();
  if (!plRes.ok) throw new Error(plData.error?.message ?? "Playlist fetch failed");

  const videoIds: string[] = (plData.items ?? []).map(
    (item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId
  );
  if (!videoIds.length) return [];

  // Step 2: get snippet + statistics for those IDs in one request
  const vRes = await fetch(
    `${cfg.apiBase}/videos?part=snippet,statistics&id=${videoIds.join(",")}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  const vData = await vRes.json();
  if (!vRes.ok) throw new Error(vData.error?.message ?? "Videos fetch failed");

  return (vData.items ?? []).map(
    (v: {
      id: string;
      snippet: {
        title: string;
        thumbnails: { medium: { url: string } };
        publishedAt: string;
      };
      statistics: { viewCount?: string; likeCount?: string; commentCount?: string };
    }) => ({
      id:          v.id,
      title:       v.snippet.title,
      thumbnail:   v.snippet.thumbnails?.medium?.url ?? "",
      publishedAt: v.snippet.publishedAt,
      views:       parseInt(v.statistics.viewCount    ?? "0", 10),
      likes:       parseInt(v.statistics.likeCount    ?? "0", 10),
      comments:    parseInt(v.statistics.commentCount ?? "0", 10),
    })
  );
}
