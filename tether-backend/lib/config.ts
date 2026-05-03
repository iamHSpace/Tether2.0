/**
 * lib/config.ts — single source of truth for all configuration constants.
 *
 * Rules:
 *  - No magic strings anywhere in the codebase. Import from here.
 *  - Runtime values (URLs, secrets) come from environment variables.
 *  - NEXT_PUBLIC_* vars are available in both server and browser contexts.
 *  - All paths are derived from APP_URL so switching environments
 *    (local → staging → production) requires changing exactly one env var.
 */

// ─── Base URLs ────────────────────────────────────────────────────────────────
// APP_URL    — the backend itself (used for self-referencing API paths)
// FRONTEND_URL — the separately deployed frontend (used for post-auth redirects)

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

/** The frontend origin. After OAuth flows the browser is redirected here. */
export const FRONTEND_URL =
  process.env.FRONTEND_URL ?? "http://127.0.0.1:3001";

// ─── App routes ───────────────────────────────────────────────────────────────

export const routes = {
  home:              `${APP_URL}/`,
  login:             `${APP_URL}/login`,
  signup:            `${APP_URL}/signup`,
  authCallback:      `${APP_URL}/api/auth/callback`,
  logout:            `${APP_URL}/api/auth/logout`,
  youtubeOAuth:      `${APP_URL}/api/oauth/youtube`,
  youtubeCallback:   `${APP_URL}/api/oauth/youtube/callback`,
  youtubeStats:      `${APP_URL}/api/youtube/stats`,
  docs:              `${APP_URL}/docs`,
  docsSpec:          `${APP_URL}/api/docs`,
} as const;

// ─── Platform identifiers ─────────────────────────────────────────────────────
// Used as the `platform` column value in the platform_tokens table.
// Centralised so a typo in one place can't silently break DB queries.

export const platforms = {
  YOUTUBE:   "youtube",
  INSTAGRAM: "instagram",
} as const;

export type Platform = (typeof platforms)[keyof typeof platforms];

// ─── YouTube OAuth + Data API ─────────────────────────────────────────────────

export const youtube = {
  // OAuth endpoints
  authUrl:      "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl:     "https://oauth2.googleapis.com/token",

  // Data API v3
  apiBase:      "https://www.googleapis.com/youtube/v3",

  // Scopes — youtube.readonly covers channels, videos, playlists, search
  scopes:       "https://www.googleapis.com/auth/youtube.readonly",

  // How many recent videos to fetch on the dashboard
  maxRecentVideos: 5,
} as const;

// ─── Encryption ───────────────────────────────────────────────────────────────

export const encryption = {
  algorithm: "aes-256-gcm" as const,
  ivBytes:    16,
} as const;

// ─── Runtime guard ────────────────────────────────────────────────────────────
// Warn in development if NEXT_PUBLIC_APP_URL is not explicitly set, so the
// fallback value doesn't silently slip into a staging/production build.

if (process.env.NODE_ENV === "development") {
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    console.warn(
      "[config] NEXT_PUBLIC_APP_URL is not set — " +
      `falling back to "${APP_URL}". ` +
      "Add it to .env.local to silence this warning."
    );
  }
  if (!process.env.FRONTEND_URL) {
    console.warn(
      "[config] FRONTEND_URL is not set — " +
      `falling back to "${FRONTEND_URL}". ` +
      "Add it to .env.local to silence this warning."
    );
  }
}
