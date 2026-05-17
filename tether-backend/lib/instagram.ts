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
 *   INSTAGRAM_CLIENT_ID=<instagram_app_id>       (from "API setup with Instagram login" page)
 *   INSTAGRAM_CLIENT_SECRET=<instagram_app_secret>
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
  media_type:    "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  media_url:     string;
  thumbnail_url?: string;
  caption?:      string;
  timestamp:     string;
  like_count:    number;
  comments_count: number;
  // Per-post insights — require instagram_business_manage_insights scope.
  // Undefined until scope is granted or if the post type doesn't support
  // a given metric (e.g. video_views on IMAGE posts).
  reach?:               number;
  impressions?:         number;
  saved?:               number;
  shares?:              number;
  video_views?:         number;   // VIDEO only
  plays?:               number;   // REEL only
  avg_watch_time?:      number;   // REEL only (seconds)
  follows?:             number;   // follows sourced from this post
  profile_visits?:      number;   // profile visits sourced from this post
  total_interactions?:  number;   // likes + comments + saves + shares (API-computed)
}

/**
 * Account-level + audience insights.
 * Fetched once per stats call via GET /me/insights.
 * All fields are optional — any subset may be present depending on scope,
 * account type, and whether the data is available yet.
 */
export interface InstagramAccountInsights {
  // Activity metrics — sum over last 7 days
  website_clicks?:   number;
  profile_views?:    number;   // profile page visits
  account_reach?:    number;   // unique accounts reached
  account_impressions?: number;

  // Audience breakdown — lifetime snapshots (fractions, 0.0–1.0 unless noted)
  audience_gender_age?: Record<string, number>;  // "M.25-34" → 0.38
  audience_country?:    Record<string, number>;  // "IN" → 0.65
  audience_city?:       Record<string, number>;  // "Mumbai" → 0.12
  online_followers?:    Record<string, number>;  // "0"–"23" → follower count (absolute)

  // 30-day daily time series (one number per day, oldest→newest)
  reach_30d?:       number[];
  impressions_30d?: number[];
}

/** Richer audience demographics fetched via /{id}/insights (includes locale). */
export interface InstagramAudience {
  gender_age?: Record<string, number>;  // "M.25-34" → fraction
  country?:    Record<string, number>;  // "IN" → fraction
  locale?:     Record<string, number>;  // "en_US" → fraction
}

/** A single Instagram Story with optional engagement metrics. */
export interface InstagramStory {
  id:           string;
  media_url?:   string;
  timestamp:    string;
  reach?:       number;
  impressions?: number;
  exits?:       number;
  replies?:     number;
  taps_forward?: number;
  taps_back?:   number;
}

// ── Per-post insights ─────────────────────────────────────────────────────────

interface InsightMetric {
  name:   string;
  values: Array<{ value: number; end_time?: string }>;
}

/**
 * Fetches lifetime insights for a single media object.
 * Silently returns {} on any error — never throws.
 *
 * video_views is requested only for VIDEO posts; plays + avg_watch_time for
 * REEL posts.  Requesting these on unsupported types causes API errors.
 */
async function fetchPostInsights(
  postId:      string,
  mediaType:   "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL",
  accessToken: string,
): Promise<Partial<InstagramPost>> {
  try {
    const base = "reach,impressions,saved,shares,follows,profile_visits,total_interactions";
    let metrics = base;
    if (mediaType === "VIDEO") metrics = `${base},video_views`;
    if (mediaType === "REEL")  metrics = `${base},plays,ig_reels_avg_watch_time`;

    const res = await fetch(
      `${cfg.apiBase}/${postId}/insights?metric=${metrics}&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const data = await res.json() as { data?: InsightMetric[] };
    if (!data.data) return {};

    const getValue = (name: string): number | undefined =>
      data.data!.find(d => d.name === name)?.values?.[0]?.value;

    return {
      reach:              getValue("reach"),
      impressions:        getValue("impressions"),
      saved:              getValue("saved"),
      shares:             getValue("shares"),
      follows:            getValue("follows"),
      profile_visits:     getValue("profile_visits"),
      total_interactions: getValue("total_interactions"),
      ...(mediaType === "VIDEO" ? { video_views: getValue("video_views") } : {}),
      ...(mediaType === "REEL"  ? { plays: getValue("plays"), avg_watch_time: getValue("ig_reels_avg_watch_time") } : {}),
    };
  } catch {
    return {};
  }
}

// ── Account-level insights ────────────────────────────────────────────────────

/**
 * Fetches period-based activity metrics for the authenticated account.
 * Uses period=day with a 7-day window and sums the daily values.
 * Metrics: website_clicks, profile_views, reach, impressions.
 */
async function fetchPeriodInsights(accessToken: string): Promise<Partial<InstagramAccountInsights>> {
  try {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 7 * 24 * 3600;
    const metrics = "website_clicks,profile_views,reach,impressions";
    const res = await fetch(
      `${cfg.apiBase}/me/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const data = await res.json() as { data?: InsightMetric[] };
    if (!data.data) return {};

    const getSum = (name: string): number | undefined => {
      const m = data.data!.find(d => d.name === name);
      if (!m?.values?.length) return undefined;
      return m.values.reduce((s, v) => s + (v.value ?? 0), 0);
    };

    return {
      website_clicks:       getSum("website_clicks"),
      profile_views:        getSum("profile_views"),
      account_reach:        getSum("reach"),
      account_impressions:  getSum("impressions"),
    };
  } catch {
    return {};
  }
}

/**
 * Fetches lifetime audience demographic snapshots.
 * Metrics: audience_gender_age, audience_country, audience_city, online_followers.
 */
async function fetchAudienceInsights(accessToken: string): Promise<Partial<InstagramAccountInsights>> {
  try {
    const metrics = "audience_gender_age,audience_country,audience_city,online_followers";
    const res = await fetch(
      `${cfg.apiBase}/me/insights?metric=${metrics}&period=lifetime&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const data = await res.json() as { data?: InsightMetric[] };
    if (!data.data) return {};

    const getObj = (name: string): Record<string, number> | undefined => {
      const m = data.data!.find(d => d.name === name);
      const raw = m?.values?.[0]?.value;
      return raw && typeof raw === "object" ? raw as Record<string, number> : undefined;
    };

    return {
      audience_gender_age: getObj("audience_gender_age"),
      audience_country:    getObj("audience_country"),
      audience_city:       getObj("audience_city"),
      online_followers:    getObj("online_followers"),
    };
  } catch {
    return {};
  }
}

/**
 * Fetches all account-level and audience insights in parallel.
 * Never throws — returns whatever data is available.
 */
export async function getInstagramAccountInsights(
  accessToken: string,
): Promise<InstagramAccountInsights> {
  const [period, audience] = await Promise.allSettled([
    fetchPeriodInsights(accessToken),
    fetchAudienceInsights(accessToken),
  ]);
  return {
    ...(period.status   === "fulfilled" ? period.value   : {}),
    ...(audience.status === "fulfilled" ? audience.value : {}),
  };
}

/**
 * Fetches 30 days of daily reach + impressions via /me/insights.
 * Uses the same proven endpoint as fetchPeriodInsights but with a 30-day window
 * and returns the per-day arrays instead of summing.
 * Returns arrays of numbers (oldest→newest).  Never throws.
 */
export async function getAccountInsights30d(
  accessToken: string,
): Promise<Pick<InstagramAccountInsights, "reach_30d" | "impressions_30d">> {
  try {
    const until = Math.floor(Date.now() / 1000);
    const since = until - 30 * 24 * 3600;
    const res = await fetch(
      `${cfg.apiBase}/me/insights?metric=reach,impressions&period=day&since=${since}&until=${until}&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return {};
    const data = await res.json() as { data?: InsightMetric[] };
    if (!data.data) return {};

    const getValues = (name: string): number[] | undefined => {
      const m = data.data!.find(d => d.name === name);
      if (!m?.values?.length) return undefined;
      return m.values.map(v => v.value ?? 0);
    };

    return {
      reach_30d:       getValues("reach"),
      impressions_30d: getValues("impressions"),
    };
  } catch {
    return {};
  }
}

/**
 * Fetches the user's active stories and per-story engagement metrics in parallel.
 * Uses /me/stories (Instagram Login flow — no user-id required in path).
 * Returns an empty array on any error or when no stories are live.
 */
export async function getStoriesInsights(
  accessToken: string,
): Promise<InstagramStory[]> {
  try {
    const res = await fetch(
      `${cfg.apiBase}/me/stories?fields=id,media_url,timestamp&access_token=${accessToken}`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const data = await res.json() as {
      data?: Array<{ id: string; media_url?: string; timestamp: string }>;
    };
    const stories = data.data ?? [];
    if (!stories.length) return [];

    // Fan out per-story insight requests in parallel
    const insightResults = await Promise.allSettled(
      stories.map(async s => {
        const ires = await fetch(
          `${cfg.apiBase}/${s.id}/insights?metric=exits,impressions,reach,replies,taps_forward,taps_back&period=lifetime&access_token=${accessToken}`,
          { cache: "no-store" },
        );
        if (!ires.ok) return {} as Partial<InstagramStory>;
        const idata = await ires.json() as { data?: InsightMetric[] };
        if (!idata.data) return {} as Partial<InstagramStory>;
        const getValue = (name: string): number | undefined =>
          idata.data!.find(d => d.name === name)?.values?.[0]?.value;
        return {
          exits:        getValue("exits"),
          impressions:  getValue("impressions"),
          reach:        getValue("reach"),
          replies:      getValue("replies"),
          taps_forward: getValue("taps_forward"),
          taps_back:    getValue("taps_back"),
        } as Partial<InstagramStory>;
      }),
    );

    return stories.map((s, i) => ({
      id:        s.id,
      media_url: s.media_url,
      timestamp: s.timestamp,
      ...(insightResults[i].status === "fulfilled" ? insightResults[i].value : {}),
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches recent media from the authenticated user's Instagram account,
 * then enriches each post with per-post insights fetched in parallel.
 *
 * Insight fetch failures are silenced — the post is still returned without
 * insight fields. Robust against accounts without the insights scope or
 * post types that don't support specific metrics.
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

  const posts = (data.data ?? []) as InstagramPost[];
  if (!posts.length) return posts;

  // Fan out insights requests in parallel — one per post, passing media_type
  // so video_views is only requested for VIDEO posts (other types error on it)
  const insightResults = await Promise.allSettled(
    posts.map(p => fetchPostInsights(p.id, p.media_type, accessToken)),
  );

  return posts.map((post, i) => {
    const insights = insightResults[i].status === "fulfilled" ? insightResults[i].value : {};
    return { ...post, ...insights };
  });
}
