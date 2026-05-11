/**
 * Instagram OAuth helpers — Instagram Login flow.
 *
 * Uses api.instagram.com/oauth/authorize (Instagram Login), NOT the Facebook
 * Login dialog.  Works for any Professional Instagram account without needing
 * a linked Facebook Page.
 *
 * Required app setup in Meta Developer Console:
 *   - Add "Instagram" product → Instagram Login
 *   - Add redirect URI under Instagram Login → OAuth Redirect URIs
 *   - No Facebook Login product needed
 *
 * Set in .env.local:
 *   INSTAGRAM_CLIENT_ID=<facebook_app_id>
 *   INSTAGRAM_CLIENT_SECRET=<facebook_app_secret>
 *   INSTAGRAM_REDIRECT_URI=<override — optional>
 *
 * OAuth flow:
 *   1. getAuthUrl(state)            → send user to Instagram consent screen
 *   2. exchangeCodeForTokens(code)  → short-lived Instagram user access token (1 hr)
 *   3. getLongLivedToken(token)     → exchange for long-lived token (~60 days)
 *   4. getInstagramAccount(token)   → fetch profile via GET /me
 */

import crypto from "crypto";
import { instagram as cfg, routes } from "@/lib/config";

// ─── Signed state (same pattern as YouTube) ───────────────────────────────────

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function createSignedState(userId: string): string {
  const secret = process.env.ENCRYPTION_SECRET!;
  const ts     = Date.now().toString();
  const sig    = crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${ts}:instagram`)
    .digest("hex");
  return Buffer.from(JSON.stringify({ userId, ts, sig })).toString("base64url");
}

export function verifySignedState(state: string): string | null {
  try {
    const secret = process.env.ENCRYPTION_SECRET!;
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
    const { userId, ts, sig } = parsed as Record<string, string>;
    if (!userId || !ts || !sig) return null;

    if (Date.now() - parseInt(ts, 10) > STATE_MAX_AGE_MS) return null;

    const expected    = crypto.createHmac("sha256", secret).update(`${userId}:${ts}:instagram`).digest("hex");
    const sigBuf      = Buffer.from(sig, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    return userId;
  } catch {
    return null;
  }
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function getAuthUrl(state: string): string {
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ?? routes.instagramCallback;

  const params = new URLSearchParams({
    client_id:     process.env.INSTAGRAM_CLIENT_ID!,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         cfg.scopes,
    state,
  });

  return `${cfg.authUrl}?${params.toString()}`;
}

export interface TokenResponse {
  access_token: string;
  token_type:   string;
}

/**
 * Exchange the authorization code for a short-lived Instagram user access
 * token (valid ~1 hour).  Returns { access_token, token_type }.
 */
export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI ?? routes.instagramCallback;

  const res = await fetch(cfg.tokenUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type:    "authorization_code",
      redirect_uri:  redirectUri,
      code,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      data.error_message ??
      data.error?.message ??
      data.error_description ??
      "Token exchange failed"
    );
  }
  return data as TokenResponse;
}

/**
 * Exchange a short-lived token for a long-lived one (~60 days).
 * Uses the Instagram Graph API endpoint (no version segment).
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(cfg.longTokenUrl);
  url.searchParams.set("grant_type",     "ig_exchange_token");
  url.searchParams.set("client_secret",  process.env.INSTAGRAM_CLIENT_SECRET!);
  url.searchParams.set("access_token",   shortLivedToken);

  const res  = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Long-lived token exchange failed");
  }
  return data as { access_token: string; expires_in: number };
}

// ─── Account / Media ─────────────────────────────────────────────────────────

export interface InstagramAccount {
  id:       string;   // Instagram user ID
  name:     string;   // Display name (full_name)
  username: string;   // Instagram handle (without @)
  followers_count: number;
  media_count:     number;
  profile_picture_url?: string;
}

/**
 * Fetches the authenticated user's Instagram profile via GET /me.
 * No Facebook Pages required — works with any Professional Instagram account.
 */
export async function getInstagramAccount(accessToken: string): Promise<InstagramAccount> {
  const fields = "id,username,name,followers_count,media_count,profile_picture_url";
  const res = await fetch(
    `${cfg.apiBase}/me?fields=${fields}&access_token=${accessToken}`,
    { cache: "no-store" }
  );
  const data = await res.json();

  if (!res.ok || !data.username) {
    throw new Error(
      data.error?.message ??
      "Failed to fetch Instagram account. Make sure the account is a Professional (Business/Creator) account."
    );
  }

  return {
    id:                  data.id,
    name:                data.name ?? data.username,
    username:            data.username,
    followers_count:     data.followers_count ?? 0,
    media_count:         data.media_count ?? 0,
    profile_picture_url: data.profile_picture_url,
  };
}

export interface InstagramPost {
  id:            string;
  media_type:    "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url:     string;
  thumbnail_url?: string;
  caption?:      string;
  timestamp:     string;
  like_count:    number;
  comments_count: number;
}

/**
 * Fetches recent media from the authenticated user's Instagram account.
 * Uses GET /me/media — no separate user ID needed.
 */
export async function getInstagramMedia(
  accessToken: string,
  _igUserId?: string,   // kept for API compatibility; /me/media is used instead
  limit = 9,
): Promise<InstagramPost[]> {
  const fields = "id,media_type,media_url,thumbnail_url,caption,timestamp,like_count,comments_count";
  const res = await fetch(
    `${cfg.apiBase}/me/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`,
    { cache: "no-store" },
  );
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message ?? "Failed to fetch Instagram media");
  }
  return (data.data ?? []) as InstagramPost[];
}
