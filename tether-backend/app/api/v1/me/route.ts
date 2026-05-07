import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, ApiKeyError } from "@/lib/apiKeyGuard";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/v1/me
 *
 * @openapi
 * tags: [v1]
 * summary: Get authenticated creator's own profile
 * description: |
 *   Returns the full profile and latest metrics for the creator whose API key
 *   is used to authenticate. Useful for embedding your Tether stats in external
 *   dashboards or automations.
 *
 * Authentication: Bearer tth_<key>
 */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireApiKey(req.headers.get("Authorization"));
  } catch (e) {
    if (e instanceof ApiKeyError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, username, full_name, bio, website, avatar_url, creator_stage, category, metric_visibility, updated_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const { data: platforms } = await adminClient
    .from("platform_tokens")
    .select("platform, platform_username, platform_user_id, metadata, created_at")
    .eq("user_id", userId);

  const { data: snapshots } = await adminClient.rpc("get_latest_snapshots", { p_user_id: userId });

  const latestSnapshots: Record<string, { data: unknown; captured_at: string }> = {};
  for (const s of snapshots ?? []) {
    latestSnapshots[s.platform] = { data: s.data, captured_at: s.captured_at };
  }

  return NextResponse.json({ profile, platforms: platforms ?? [], snapshots: latestSnapshots });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
