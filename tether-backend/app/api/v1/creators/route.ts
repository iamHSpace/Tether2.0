import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, ApiKeyError } from "@/lib/apiKeyGuard";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/v1/creators
 *
 * @openapi
 * tags: [v1]
 * summary: Search creator profiles
 * description: |
 *   Returns paginated creator profiles with their latest YouTube metrics.
 *   Requires a valid API key in the Authorization header.
 *
 * Authentication: Bearer tth_<key>
 *
 * Query params:
 *   q            - text search on username / full_name
 *   category     - filter by creator category
 *   creator_stage - filter by stage (e.g. "nano", "micro", "macro")
 *   sort_by      - subscribers | avg_views | total_views | video_count (default: subscribers)
 *   limit        - max results per page (default: 20, max: 50)
 *   offset       - pagination offset (default: 0)
 *   min_subs / max_subs
 *   min_avg_views / max_avg_views
 */
export async function GET(req: NextRequest) {
  let _userId: string;
  try {
    _userId = await requireApiKey(req.headers.get("Authorization"));
  } catch (e) {
    if (e instanceof ApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const sp    = new URL(req.url).searchParams;
  const q     = (sp.get("q") ?? "").trim();
  const cat   = (sp.get("category") ?? "").trim();
  const stage = (sp.get("creator_stage") ?? "").trim();
  const sortBy = sp.get("sort_by") ?? "subscribers";
  const limit  = Math.min(parseInt(sp.get("limit") ?? "20", 10) || 20, 50);
  const offset = parseInt(sp.get("offset") ?? "0", 10) || 0;
  const minSubs = parseInt(sp.get("min_subs") ?? "0", 10) || 0;
  const maxSubs = parseInt(sp.get("max_subs") ?? "0", 10) || 0;
  const minAvg  = parseInt(sp.get("min_avg_views") ?? "0", 10) || 0;
  const maxAvg  = parseInt(sp.get("max_avg_views") ?? "0", 10) || 0;

  let query = adminClient
    .from("profiles")
    .select("id, username, full_name, bio, category, creator_stage, avatar_url, updated_at")
    .eq("user_type", "creator")
    .not("username", "is", null);

  if (cat)   query = query.eq("category", cat);
  if (stage) query = query.eq("creator_stage", stage);
  if (q)     query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);

  type ProfileRow = { id: string; username: string; full_name: string | null; bio: string | null; category: string | null; creator_stage: string | null; avatar_url: string | null; updated_at: string };
  const { data: rawProfiles, error } = await query;
  const profiles = (rawProfiles ?? []) as ProfileRow[];
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profiles.length) return NextResponse.json({ creators: [], total: 0 });

  const userIds = profiles.map((p) => p.id);
  const { data: snapshots } = await adminClient
    .from("metric_snapshots")
    .select("user_id, data")
    .eq("platform", "youtube")
    .in("user_id", userIds)
    .order("captured_at", { ascending: false });

  type SnapMetrics = { subscribers: number; totalViews: number; videoCount: number; avgViews: number };
  const latestSnap: Record<string, SnapMetrics> = {};
  for (const s of snapshots ?? []) {
    if (latestSnap[s.user_id]) continue;
    const ch = (s.data as { channel?: { subscribers?: number; totalViews?: number; videoCount?: number } })?.channel;
    const vids = ch?.videoCount ?? 0;
    const views = ch?.totalViews ?? 0;
    latestSnap[s.user_id] = {
      subscribers: ch?.subscribers ?? 0,
      totalViews:  views,
      videoCount:  vids,
      avgViews:    vids > 0 ? Math.round(views / vids) : 0,
    };
  }

  type Row = {
    id: string; username: string; full_name: string | null; bio: string | null;
    category: string | null; creator_stage: string | null; avatar_url: string | null;
    updated_at: string; subscribers: number; total_views: number; video_count: number; avg_views: number;
  };

  let results: Row[] = profiles
    .filter((p) => {
      const s = latestSnap[p.id];
      if (!s) return false;
      if (minSubs && s.subscribers < minSubs) return false;
      if (maxSubs && s.subscribers > maxSubs) return false;
      if (minAvg  && s.avgViews    < minAvg)  return false;
      if (maxAvg  && s.avgViews    > maxAvg)  return false;
      return true;
    })
    .map((p) => ({
      id:            p.id,
      username:      p.username,
      full_name:     p.full_name,
      bio:           p.bio,
      category:      p.category,
      creator_stage: p.creator_stage,
      avatar_url:    p.avatar_url,
      updated_at:    p.updated_at,
      subscribers:   latestSnap[p.id].subscribers,
      total_views:   latestSnap[p.id].totalViews,
      video_count:   latestSnap[p.id].videoCount,
      avg_views:     latestSnap[p.id].avgViews,
    }));

  const sortMap: Record<string, keyof Row> = {
    subscribers: "subscribers", avg_views: "avg_views",
    total_views: "total_views", video_count: "video_count",
  };
  const key = sortMap[sortBy] ?? "subscribers";
  results.sort((a, b) => (b[key] as number) - (a[key] as number));

  return NextResponse.json(
    { creators: results.slice(offset, offset + limit), total: results.length },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
