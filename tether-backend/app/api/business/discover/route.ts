import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

function num(s: string | null, fallback: number): number {
  if (!s) return fallback;
  const n = parseInt(s, 10);
  return isNaN(n) ? fallback : n;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;

  const q             = (sp.get("q") ?? "").trim().toLowerCase();
  const category      = (sp.get("category") ?? "").trim();
  const creator_stage = (sp.get("creator_stage") ?? "").trim();
  const sort_by       = sp.get("sort_by") ?? "subscribers"; // subscribers | avg_views | total_views | video_count
  const limit         = Math.min(num(sp.get("limit"), 30), 60);
  const offset        = num(sp.get("offset"), 0);

  // Metric range filters (applied in-memory after snapshot fetch)
  const min_subs      = num(sp.get("min_subs"),      0);
  const max_subs      = num(sp.get("max_subs"),      Infinity);
  const min_avg_views = num(sp.get("min_avg_views"), 0);
  const max_avg_views = num(sp.get("max_avg_views"), Infinity);
  const min_videos    = num(sp.get("min_videos"),    0);
  const max_videos    = num(sp.get("max_videos"),    Infinity);

  // 1. Profile query — text search + profile-level filters done in Postgres
  let profileQuery = adminClient
    .from("profiles")
    .select("id, username, full_name, bio, category, creator_stage, avatar_url")
    .not("username", "is", null)
    .neq("user_type", "business");

  if (category)      profileQuery = profileQuery.eq("category", category);
  if (creator_stage) profileQuery = profileQuery.eq("creator_stage", creator_stage);
  if (q)             profileQuery = profileQuery.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);

  const { data: profiles, error: profileError } = await profileQuery;
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profiles || profiles.length === 0) return NextResponse.json({ creators: [], total: 0 });

  // 2. Batch-fetch latest YouTube snapshot for all matching profiles
  const userIds = profiles.map((p: { id: string }) => p.id);

  const { data: snapshots } = await adminClient
    .from("metric_snapshots")
    .select("user_id, data")
    .eq("platform", "youtube")
    .in("user_id", userIds)
    .order("captured_at", { ascending: false });

  const latestSnap: Record<string, { subscribers: number; totalViews: number; videoCount: number; avgViews: number }> = {};
  for (const snap of snapshots ?? []) {
    if (latestSnap[snap.user_id]) continue;
    const ch = (snap.data as { channel?: { subscribers?: number; totalViews?: number; videoCount?: number } })?.channel;
    const subs  = ch?.subscribers  ?? 0;
    const views = ch?.totalViews   ?? 0;
    const vids  = ch?.videoCount   ?? 0;
    latestSnap[snap.user_id] = {
      subscribers: subs,
      totalViews:  views,
      videoCount:  vids,
      avgViews:    vids > 0 ? Math.round(views / vids) : 0,
    };
  }

  // 3. Merge + apply metric filters + sort + paginate (all in-memory)
  type MergedCreator = {
    id: string; username: string; full_name: string | null; bio: string | null;
    category: string | null; creator_stage: string | null;
    subscribers: number; total_views: number; video_count: number; avg_views: number;
  };

  const merged: MergedCreator[] = profiles
    .filter((p: { id: string }) => {
      const s = latestSnap[p.id];
      if (!s) return false;
      if (s.subscribers < min_subs)      return false;
      if (s.subscribers > max_subs)      return false;
      if (s.avgViews    < min_avg_views) return false;
      if (s.avgViews    > max_avg_views) return false;
      if (s.videoCount  < min_videos)    return false;
      if (s.videoCount  > max_videos)    return false;
      return true;
    })
    .map((p: { id: string; username: string; full_name: string | null; bio: string | null; category: string | null; creator_stage: string | null; avatar_url: string | null }) => ({
      id:            p.id,
      username:      p.username,
      full_name:     p.full_name,
      bio:           p.bio,
      category:      p.category,
      creator_stage: p.creator_stage,
      subscribers:   latestSnap[p.id].subscribers,
      total_views:   latestSnap[p.id].totalViews,
      video_count:   latestSnap[p.id].videoCount,
      avg_views:     latestSnap[p.id].avgViews,
    }));

  const sortKey: Record<string, keyof MergedCreator> = {
    subscribers: "subscribers",
    avg_views:   "avg_views",
    total_views: "total_views",
    video_count: "video_count",
  };
  const key = sortKey[sort_by] ?? "subscribers";
  merged.sort((a, b) => (b[key] as number) - (a[key] as number));

  return NextResponse.json({ creators: merged.slice(offset, offset + limit), total: merged.length });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
