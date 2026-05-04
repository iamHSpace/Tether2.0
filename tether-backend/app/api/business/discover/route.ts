import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q        = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = (searchParams.get("category") ?? "").trim();
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 60);
  const offset   = parseInt(searchParams.get("offset") ?? "0", 10);

  // 1. Fetch creator profiles (exclude business users, require a set username)
  let profileQuery = adminClient
    .from("profiles")
    .select("id, username, full_name, bio, category, creator_stage, avatar_url")
    .not("username", "is", null)
    .neq("user_type", "business");

  if (category) profileQuery = profileQuery.eq("category", category);

  if (q) {
    profileQuery = profileQuery.or(
      `username.ilike.%${q}%,full_name.ilike.%${q}%`
    );
  }

  const { data: profiles, error: profileError } = await profileQuery;

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ creators: [], total: 0 });
  }

  // 2. Get latest YouTube snapshot for each profile in one query
  const userIds = profiles.map((p: { id: string }) => p.id);

  const { data: snapshots } = await adminClient
    .from("metric_snapshots")
    .select("user_id, data")
    .eq("platform", "youtube")
    .in("user_id", userIds)
    .order("captured_at", { ascending: false });

  // Keep only the most-recent snapshot per user
  const latestSnap: Record<string, { subscribers: number; totalViews: number; videoCount: number }> = {};
  for (const snap of snapshots ?? []) {
    if (!latestSnap[snap.user_id]) {
      const ch = (snap.data as { channel?: { subscribers?: number; totalViews?: number; videoCount?: number } })?.channel;
      latestSnap[snap.user_id] = {
        subscribers: ch?.subscribers ?? 0,
        totalViews:  ch?.totalViews  ?? 0,
        videoCount:  ch?.videoCount  ?? 0,
      };
    }
  }

  // 3. Merge, sort by subscribers, paginate
  const merged = profiles
    .filter((p: { id: string }) => latestSnap[p.id] !== undefined)  // only creators with snapshot data
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
    }))
    .sort((a: { subscribers: number }, b: { subscribers: number }) => b.subscribers - a.subscribers);

  const total = merged.length;
  const page  = merged.slice(offset, offset + limit);

  return NextResponse.json({ creators: page, total });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
