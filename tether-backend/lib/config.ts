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

// ─── Base URL ─────────────────────────────────────────────────────────────────
// Set NEXT_PUBLIC_APP_URL in .env.local.
// Fallback is only for type safety — the app will warn loudly at runtime if
// the env var is missing (see the check at the bottom of this file).

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

// ─── App routes ───────────────────────────────────────────────────────────────

export const routes = {
  home:              `${APP_URL}/`,
  login:             `${APP_URL}/login`,
  authCallback:      `${APP_URL}/api/auth/callback`,
  logout:            `${APP_URL}/api/auth/logout`,
  youtubeOAuth:      `${APP_URL}/api/oauth/youtube`,
  youtubeCallback:   `${APP_URL}/api/oauth/youtube/callback`,
  youtubeStats:      `${APP_URL}/api/youtube/stats`,
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

if (
  process.env.NODE_ENV === "development" &&
  !process.env.NEXT_PUBLIC_APP_URL
) {
  console.warn(
    "[config] NEXT_PUBLIC_APP_URL is not set — " +
    `falling back to "${APP_URL}". ` +
    "Add it to .env.local to silence this warning."
  );
}
