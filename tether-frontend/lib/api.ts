/**
 * lib/api.ts — typed client for the tether-backend API.
 *
 * Authenticated requests use Authorization: Bearer <token>.
 * Public requests (e.g. creator profiles) send no token.
 */

import { supabase } from "@/lib/supabase";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

// ── Auth header ───────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

/** Authenticated GET */
async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Authenticated POST */
async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Authenticated PUT */
async function put<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND}${path}`, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Unauthenticated GET (public endpoints) */
async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface MetricVisibility {
  subscribers:   boolean;
  total_views:   boolean;
  video_count:   boolean;
  avg_views:     boolean;
  view_chart:    boolean;
  recent_videos: boolean;
}

export const DEFAULT_METRIC_VISIBILITY: MetricVisibility = {
  subscribers: true, total_views: true, video_count: true,
  avg_views: true, view_chart: true, recent_videos: true,
};

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  creator_stage: string | null;
  aspiration: string | null;
  platform_reason: string | null;
  metric_visibility: MetricVisibility | null;
}

export interface ProfileResponse {
  profile: Profile;
  email: string | null;
}

export type ProfileUpdate = Partial<Omit<Profile, "id">>;

export interface PlatformInfo {
  platform: string;
  platform_username: string;
  platform_user_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreatorResponse {
  profile: Profile;
  platforms: PlatformInfo[];
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  /** YouTube — authenticated */
  youtube: {
    stats: () => get<YouTubeStatsResponse>("/api/youtube/stats"),
    connect: async () => {
      const { url } = await post<{ url: string }>("/api/oauth/youtube");
      window.location.href = url;
    },
  },

  /** Instagram — authenticated */
  instagram: {
    connect: async () => {
      const { url } = await post<{ url: string }>("/api/oauth/instagram");
      window.location.href = url;
    },
  },

  /** Authenticated user's own profile */
  profile: {
    get: () => get<ProfileResponse>("/api/profile"),
    update: (data: ProfileUpdate) => put<{ profile: Profile }>("/api/profile", data),
    updateMetrics: (visibility: MetricVisibility) =>
      put<{ profile: Profile }>("/api/profile", { metric_visibility: visibility }),
    checkUsername: (username: string) =>
      get<{ available: boolean; error?: string }>(
        `/api/profile/check-username?username=${encodeURIComponent(username)}`
      ),
  },

  /** Public creator profiles — no auth required */
  creators: {
    get: (username: string) =>
      publicGet<CreatorResponse>(`/api/creators/${encodeURIComponent(username)}`),
  },

  /** Auth helpers */
  auth: {
    me: () => get<{ user: { id: string; email: string } | null }>("/api/me"),
  },
};
