/**
 * lib/api.ts — typed client for the tether-backend API.
 *
 * Authenticated requests use Authorization: Bearer <token>.
 * Public requests (e.g. creator profiles) send no token.
 */

import { supabase } from "@/lib/supabase";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

// ── Typed error ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

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
    throw new ApiError((body as { error?: string }).error ?? `Request failed: ${res.status}`, res.status);
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
    throw new ApiError((data as { error?: string }).error ?? `Request failed: ${res.status}`, res.status);
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
    throw new ApiError((data as { error?: string }).error ?? `Request failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Authenticated DELETE */
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
    throw new ApiError((data as { error?: string }).error ?? `Request failed: ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

/** Unauthenticated GET (public endpoints) */
async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { next: { revalidate: 300 } } as RequestInit);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { error?: string }).error ?? `Request failed: ${res.status}`, res.status);
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
  company_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  creator_stage: string | null;
  aspiration: string | null;
  platform_reason: string | null;
  metric_visibility: MetricVisibility | null;
  category: string | null;
  user_type: "creator" | "business" | null;
  updated_at?: string;
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

export interface SnapshotData {
  channel: {
    id: string; name: string; handle: string; thumbnail: string;
    subscribers: number; totalViews: number; videoCount: number;
  };
  videos: VideoSummary[];
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

export interface BusinessProfile {
  id: string;
  username: string | null;
  company_name: string | null;
  full_name: string | null;
  bio: string | null;
  website: string | null;
  category: string | null;
  updated_at: string;
}

export interface BusinessesResponse {
  businesses: BusinessProfile[];
  total: number;
}

export interface ConversationMessage {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  other_user: {
    id: string;
    username: string | null;
    display_name: string;
    avatar_url: string | null;
    user_type: "creator" | "business";
  };
  last_message: {
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  unread_count: number;
  last_message_at: string;
  created_at: string;
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
    views: () => get<{ this_week: number; last_week: number; all_time: number; daily: { date: string; count: number }[] }>("/api/profile/views"),
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
    getBatch: (usernames: string[]) =>
      post<{ creators: Record<string, CreatorResponse> }>("/api/business/saved-creators/batch", { usernames }),
    logView: (username: string) =>
      post<{ counted: boolean }>(`/api/creators/${encodeURIComponent(username)}/view`, {}),
  },

  /** Business — saved creators */
  saved: {
    list: () => get<{ saved: SavedCreator[] }>("/api/business/saved-creators"),
    save: (creator_username: string) =>
      post<{ saved: boolean }>("/api/business/saved-creators", { creator_username }),
    unsave: (creator_username: string) =>
      del<{ saved: boolean }>("/api/business/saved-creators", { creator_username }),
  },

  /** Business — discover search */
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

  /** Conversations & messages */
  conversations: {
    list: () => get<{ conversations: Conversation[] }>("/api/conversations"),
    start: (other_user_id: string) =>
      post<{ conversation: { id: string } }>("/api/conversations", { other_user_id }),
    messages: (id: string) =>
      get<{ messages: ConversationMessage[] }>(`/api/conversations/${id}/messages`),
    send: (id: string, body: string) =>
      post<{ message: ConversationMessage }>(`/api/conversations/${id}/messages`, { body }),
  },

  /** Businesses — for creator browse */
  businesses: {
    search: (params: { q?: string; category?: string; limit?: number; offset?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.q)        qs.set("q",        params.q);
      if (params.category) qs.set("category", params.category);
      if (params.limit)    qs.set("limit",    String(params.limit));
      if (params.offset)   qs.set("offset",   String(params.offset));
      return get<BusinessesResponse>(`/api/creators/discover-businesses?${qs}`);
    },
  },

  /** Auth helpers */
  auth: {
    me: () => get<{ user: { id: string; email: string } | null }>("/api/me"),
  },

  /** Admin — all endpoints require is_admin = true */
  admin: {
    stats: () =>
      get<AdminStats>("/api/admin/stats"),

    users: (params: { q?: string; user_type?: string; suspended?: string; page?: number; limit?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.q)         qs.set("q",         params.q);
      if (params.user_type) qs.set("user_type",  params.user_type);
      if (params.suspended) qs.set("suspended",  params.suspended);
      if (params.page)      qs.set("page",       String(params.page));
      if (params.limit)     qs.set("limit",      String(params.limit));
      return get<AdminUsersResponse>(`/api/admin/users?${qs}`);
    },

    updateUser: (id: string, patch: { user_type?: string; is_suspended?: boolean; is_admin?: boolean }) =>
      put<{ user: AdminUser }>(`/api/admin/users/${id}`, patch),

    deleteUser: (id: string) =>
      del<{ ok: boolean }>(`/api/admin/users/${id}`),

    platformHealth: () =>
      get<AdminHealthResponse>("/api/admin/platform-health"),

    triggerSnapshot: () =>
      post<{ succeeded: number; failed: number; total: number }>("/api/admin/snapshot/trigger"),

    analytics: (days?: number) =>
      get<AdminAnalytics>(`/api/admin/analytics${days ? `?days=${days}` : ""}`),

    conversations: (params: { page?: number; limit?: number } = {}) => {
      const qs = new URLSearchParams();
      if (params.page)  qs.set("page",  String(params.page));
      if (params.limit) qs.set("limit", String(params.limit));
      return get<AdminConversationsResponse>(`/api/admin/conversations?${qs}`);
    },

    conversation: (id: string) =>
      get<AdminConversationDetail>(`/api/admin/conversations/${id}`),

    flagProfile: (id: string, suspended: boolean) =>
      put<{ profile: { id: string; username: string; is_suspended: boolean } }>(
        `/api/admin/profiles/${id}/flag`,
        { suspended }
      ),
  },

  /** Developer API keys */
  developer: {
    keys: () => get<{ keys: ApiKey[] }>("/api/developer/keys"),
    createKey: (name: string, expires_at?: string) =>
      post<{ key: ApiKeyCreated }>("/api/developer/keys", { name, expires_at }),
    revokeKey: (id: string) => del<{ revoked: boolean }>(`/api/developer/keys/${id}`),
  },
};

// ── Admin types ───────────────────────────────────────────────────────────────

export interface AdminStats {
  users:     { total: number; creators: number; businesses: number; activeCreators: number };
  pageViews: { today: number; week: number; month: number };
  messaging: { conversations: number; messages: number };
}

export interface AdminUser {
  id: string; username: string | null; full_name: string | null; company_name: string | null;
  user_type: string; is_admin: boolean; is_suspended: boolean;
  last_active_at: string | null; created_at: string; updated_at: string | null;
}

export interface AdminUsersResponse {
  users: AdminUser[]; total: number; page: number; limit: number;
}

export interface AdminHealthCreator {
  id: string; username: string | null; full_name: string | null; last_active_at: string | null;
  connected: boolean; channel_name: string | null;
  token_expiry: string | null; days_until_expiry: number | null;
  last_snapshot: string | null; snapshot_age_days: number | null;
  status: "healthy" | "stale" | "expiring_soon" | "disconnected";
}

export interface AdminHealthResponse {
  creators: AdminHealthCreator[]; total: number;
}

export interface AdminAnalytics {
  total: number; days: number;
  viewerType:   Record<string, number>;
  topCountries: { country: string; count: number }[];
  deviceType:   Record<string, number>;
  referrerType: Record<string, number>;
  dailyViews:   { date: string; count: number }[];
}

export interface AdminConversationSummary {
  id: string; last_message_at: string; created_at: string;
  creator:  { id: string; username: string | null; name: string };
  business: { id: string; username: string | null; name: string };
  last_message: { body: string; created_at: string } | null;
}

export interface AdminConversationsResponse {
  conversations: AdminConversationSummary[]; total: number; page: number; limit: number;
}

export interface AdminConversationDetail {
  conversation: {
    id: string; last_message_at: string; created_at: string;
    creator:  { id: string; name: string; username: string | null };
    business: { id: string; name: string; username: string | null };
  };
  messages: { id: string; sender_id: string; body: string; read_at: string | null; created_at: string }[];
}

// ── Developer / API keys ──────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface ApiKeyCreated extends ApiKey {
  raw_key: string;
}
