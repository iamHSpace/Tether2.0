import { NextRequest, NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/creators/:username
 *
 * Public endpoint — no authentication required.
 * Returns a creator's public profile and their connected platform info.
 * Never exposes access tokens or refresh tokens (they are AES-encrypted
 * in the DB anyway, but we explicitly exclude them here).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  // ── 1. Look up the profile by username ───────────────────────────────────
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, username, full_name, bio, website, avatar_url, creator_stage, aspiration, metric_visibility, category, theme_config, updated_at")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  // ── 2. Look up their connected platforms (public columns only) ───────────
  const { data: platforms, error: platformError } = await adminClient
    .from("platform_tokens")
    .select("platform, platform_username, platform_user_id, metadata, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (platformError) {
    console.error("[creators/:username] platform_tokens error:", platformError.message);
  }

  // ── 3. Fetch latest metric snapshot per platform (DISTINCT ON via RPC) ───────
  const { data: snapshots } = await adminClient.rpc("get_latest_snapshots", { p_user_id: profile.id });

  const latestSnapshots: Record<string, { data: unknown; captured_at: string }> = {};
  for (const snap of snapshots ?? []) {
    latestSnapshots[snap.platform] = { data: snap.data, captured_at: snap.captured_at };
  }

  return NextResponse.json(
    { profile, platforms: platforms ?? [], snapshots: latestSnapshots },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
