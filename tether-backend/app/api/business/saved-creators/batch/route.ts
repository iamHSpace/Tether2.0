/**
 * POST /api/business/saved-creators/batch
 *
 * Accepts { usernames: string[] } and returns a map of
 * username → CreatorResponse in a single round-trip (3 DB queries total
 * instead of 3 × N queries from individual /api/creators/:username calls).
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const usernames: string[] = Array.isArray(body.usernames) ? body.usernames : [];

  if (!usernames.length) {
    return NextResponse.json({ creators: {} });
  }

  const normalized = usernames.map(u => u.toLowerCase());

  // ── 1. Fetch all profiles in one query ────────────────────────────────────
  const { data: profiles, error: profilesError } = await adminClient
    .from("profiles")
    .select("id, username, full_name, bio, website, avatar_url, creator_stage, aspiration, metric_visibility, category, updated_at")
    .in("username", normalized);

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  if (!profiles?.length) {
    return NextResponse.json({ creators: {} });
  }

  const userIds = profiles.map(p => p.id);

  // ── 2. Fetch platforms + snapshots in parallel ────────────────────────────
  const [{ data: platforms }, { data: snapshots }] = await Promise.all([
    adminClient
      .from("platform_tokens")
      .select("user_id, platform, platform_username, platform_user_id, metadata, created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    adminClient.rpc("get_latest_snapshots_batch", { p_user_ids: userIds }),
  ]);

  // ── 3. Group by user_id and build response map ───────────────────────────
  const platformsByUser: Record<string, typeof platforms> = {};
  for (const p of platforms ?? []) {
    (platformsByUser[p.user_id] ??= []).push(p);
  }

  const snapshotsByUser: Record<string, Record<string, { data: unknown; captured_at: string }>> = {};
  for (const s of snapshots ?? []) {
    const map = (snapshotsByUser[s.user_id] ??= {});
    map[s.platform] = { data: s.data, captured_at: s.captured_at };
  }

  const result: Record<string, object> = {};
  for (const profile of profiles) {
    result[profile.username!] = {
      profile,
      platforms: platformsByUser[profile.id] ?? [],
      snapshots: snapshotsByUser[profile.id] ?? {},
    };
  }

  return NextResponse.json({ creators: result });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
