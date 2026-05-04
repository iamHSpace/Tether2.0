import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/business/saved-creators
 * Returns the authenticated business user's saved creator list,
 * joined with each creator's public profile.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await adminClient
    .from("saved_creators")
    .select("creator_username, saved_at")
    .eq("business_user_id", user.id)
    .order("saved_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: data ?? [] });
}

/**
 * POST /api/business/saved-creators
 * Body: { creator_username: string }
 * Saves a creator to the business user's list (idempotent).
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { creator_username?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const creator_username = body.creator_username?.trim().toLowerCase();
  if (!creator_username) return NextResponse.json({ error: "creator_username is required" }, { status: 400 });

  // Verify the creator exists
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", creator_username)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  const { error } = await adminClient
    .from("saved_creators")
    .upsert({ business_user_id: user.id, creator_username }, { onConflict: "business_user_id,creator_username" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: true });
}

/**
 * DELETE /api/business/saved-creators
 * Body: { creator_username: string }
 * Removes a creator from the business user's saved list.
 */
export async function DELETE(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { creator_username?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const creator_username = body.creator_username?.trim().toLowerCase();
  if (!creator_username) return NextResponse.json({ error: "creator_username is required" }, { status: 400 });

  const { error } = await adminClient
    .from("saved_creators")
    .delete()
    .eq("business_user_id", user.id)
    .eq("creator_username", creator_username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ saved: false });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
