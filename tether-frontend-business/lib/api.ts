import { supabase } from "@/lib/supabase";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${session.access_token}` };
}

async function get<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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

async function del<T>(path: string, body?: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BACKEND}${path}`, {
    method: "DELETE",
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

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  creator_stage: string | null;
  aspiration: string | null;
  metric_visibility: Record<string, boolean> | null;
  user_type: "creator" | "business" | null;
  category: string | null;
  updated_at?: string;
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

export interface SnapshotData {
  channel: {
    id: string; name: string; handle: string; thumbnail: string;
    subscribers: number; totalViews: number; videoCount: number;
  };
  videos: VideoSummary[];
}

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
  snapshots: Record<string, { data: SnapshotData; captured_at: string }>;
}

export interface SavedCreator {
  creator_username: string;
  saved_at: string;
}

export interface DiscoverCreator {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  category: string | null;
  creator_stage: string | null;
  updated_at: string;
  subscribers: number;
  total_views: number;
  video_count: number;
  avg_views: number;
}

export interface DiscoverResponse {
  creators: DiscoverCreator[];
  total: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  profile: {
    get: () => get<{ profile: Profile; email: string | null }>("/api/profile"),
    update: (data: Partial<Omit<Profile, "id">>) => put<{ profile: Profile }>("/api/profile", data),
  },

  creators: {
    get: (username: string) =>
      publicGet<CreatorResponse>(`/api/creators/${encodeURIComponent(username)}`),
  },

  saved: {
    list: () => get<{ saved: SavedCreator[] }>("/api/business/saved-creators"),
    save: (creator_username: string) =>
      post<{ saved: boolean }>("/api/business/saved-creators", { creator_username }),
    unsave: (creator_username: string) =>
      del<{ saved: boolean }>("/api/business/saved-creators", { creator_username }),
  },

  discover: {
    search: (params: {
      q?: string; category?: string; creator_stage?: string; sort_by?: string;
      min_subs?: number; max_subs?: number;
      min_avg_views?: number; max_avg_views?: number;
      min_videos?: number; max_videos?: number;
      limit?: number; offset?: number;
    } = {}) => {
      const qs = new URLSearchParams();
      const add = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== "") qs.set(k, String(v)); };
      add("q",             params.q);
      add("category",      params.category);
      add("creator_stage", params.creator_stage);
      add("sort_by",       params.sort_by);
      add("min_subs",      params.min_subs);
      add("max_subs",      params.max_subs);
      add("min_avg_views", params.min_avg_views);
      add("max_avg_views", params.max_avg_views);
      add("min_videos",    params.min_videos);
      add("max_videos",    params.max_videos);
      add("limit",         params.limit);
      add("offset",        params.offset);
      return get<DiscoverResponse>(`/api/business/discover?${qs}`);
    },
  },
};
