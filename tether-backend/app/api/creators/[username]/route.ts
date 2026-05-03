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
    .select("id, username, full_name, bio, website, avatar_url, creator_stage, aspiration")
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
    // Non-fatal — return profile with empty platforms
    console.error("[creators/:username] platform_tokens error:", platformError.message);
  }

  return NextResponse.json({
    profile,
    platforms: platforms ?? [],
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
