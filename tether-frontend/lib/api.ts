/**
 * lib/api.ts — typed client for the tether-backend API.
 *
 * The backend runs on NEXT_PUBLIC_BACKEND_URL (default: http://127.0.0.1:3000).
 * All requests include credentials (cookies) so the session is forwarded.
 */

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── YouTube ──────────────────────────────────────────────────────────────────

export interface ChannelStats {
  id: string;
  name: string;
  handle: string;
  thumbnail: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  uploadsPlaylistId: string;
}

export interface VideoSummary {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
}

export interface YouTubeStatsResponse {
  channel: ChannelStats;
  videos: VideoSummary[];
  connectedAt: string;
}

export const api = {
  youtube: {
    stats: () => get<YouTubeStatsResponse>("/api/youtube/stats"),
    connectUrl: () => `${BACKEND}/api/oauth/youtube`,
  },
  auth: {
    me: () => get<{ user: { id: string; email: string } | null }>("/api/me"),
    logoutUrl: () => `${BACKEND}/api/auth/logout`,
  },
};
