/**
 * Instagram OAuth (via Facebook Graph API) helpers.
 *
 * Instagram Graph API requires a Facebook App with:
 *   - instagram_basic
 *   - pages_read_engagement
 *   - business_management (for linked pages)
 *
 * Set in .env.local:
 *   INSTAGRAM_CLIENT_ID=<facebook_app_id>
 *   INSTAGRAM_CLIENT_SECRET=<facebook_app_secret>
 *   INSTAGRAM_REDIRECT_URI=<override — optional>
 *
 * OAuth flow:
 *   1. getAuthUrl(state)            → send user to Facebook consent screen
 *   2. exchangeCodeForTokens(code)  → short-lived user access token
 *   3. getLongLivedToken(token)     → exchange for 60-day token
 *   4. getInstagramAccount(token)   → resolve linked Instagram business account
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
    throw new Error(data.error?.message ?? data.error_description ?? "Token exchange failed");
  }
  return data as TokenResponse;
}

export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(
    `${cfg.fbApiBase}/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.INSTAGRAM_CLIENT_ID!}&client_secret=${process.env.INSTAGRAM_CLIENT_SECRET!}&fb_exchange_token=${shortLivedToken}`,
    { cache: "no-store" }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Long-lived token exchange failed");
  }
  return data;
}

export interface InstagramAccount {
  id:       string;   // Instagram business account ID
  name:     string;   // Display name
  username: string;   // Instagram handle (without @)
  followers_count: number;
  media_count:     number;
  profile_picture_url?: string;
}

/**
 * Resolves the user's linked Instagram business account from their Facebook token.
 * The user must have a professional/creator Instagram account linked to a Facebook Page.
 */
export async function getInstagramAccount(accessToken: string): Promise<InstagramAccount> {
  // 1. Get Facebook Pages the user manages
  const pagesRes = await fetch(
    `${cfg.fbApiBase}/me/accounts?access_token=${accessToken}`,
    { cache: "no-store" }
  );
  const pagesData = await pagesRes.json();
  if (!pagesRes.ok || !pagesData.data?.length) {
    throw new Error(
      pagesData.error?.message ??
      "No Facebook Pages found. Connect a professional Instagram account linked to a Facebook Page."
    );
  }

  // 2. For each page, check for a linked Instagram business account
  for (const page of pagesData.data as { id: string; access_token: string }[]) {
    const igRes = await fetch(
      `${cfg.fbApiBase}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
      { cache: "no-store" }
    );
    const igData = await igRes.json();
    const igId = igData.instagram_business_account?.id;
    if (!igId) continue;

    // 3. Fetch the Instagram account details
    const detailRes = await fetch(
      `${cfg.fbApiBase}/${igId}?fields=id,name,username,followers_count,media_count,profile_picture_url&access_token=${page.access_token}`,
      { cache: "no-store" }
    );
    const detail = await detailRes.json();
    if (detailRes.ok && detail.username) {
      return {
        id:                  detail.id,
        name:                detail.name ?? detail.username,
        username:            detail.username,
        followers_count:     detail.followers_count ?? 0,
        media_count:         detail.media_count ?? 0,
        profile_picture_url: detail.profile_picture_url,
      };
    }
  }

  throw new Error(
    "No Instagram business account found. Make sure your Instagram account is a Professional account and is linked to a Facebook Page."
  );
}
