import { NextRequest, NextResponse } from "next/server";
import { requireApiKey, ApiKeyError } from "@/lib/apiKeyGuard";
import { supabase as adminClient } from "@/lib/supabase";

async function resolveUser(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  try {
    return { userId: await requireApiKey(req.headers.get("Authorization")) };
  } catch (e) {
    if (e instanceof ApiKeyError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/v1/saved
 *
 * List creators saved by the authenticated business.
 * Only returns rows where business_user_id = userId_from_key.
 */
export async function GET(req: NextRequest) {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const { data, error } = await adminClient
    .from("saved_creators")
    .select("creator_username, saved_at")
    .eq("business_user_id", userId)   // ownership enforced — can only read own list
    .order("saved_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data ?? [] });
}

/**
 * POST /api/v1/saved
 *
 * Save a creator to the authenticated business's list.
 * Body: { creator_username: string }
 *
 * Ownership enforced: inserts with business_user_id = userId_from_key.
 * A developer cannot save to another organisation's list.
 */
export async function POST(req: NextRequest) {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  let body: { creator_username?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const creator_username = body.creator_username?.trim().toLowerCase();
  if (!creator_username) return NextResponse.json({ error: "creator_username is required" }, { status: 400 });

  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", creator_username)
    .eq("user_type", "creator")
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  // business_user_id is always the key owner — no parameter can override it
  const { error } = await adminClient
    .from("saved_creators")
    .upsert({ business_user_id: userId, creator_username }, { onConflict: "business_user_id,creator_username" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: true }, { status: 201 });
}

/**
 * DELETE /api/v1/saved
 *
 * Remove a creator from the authenticated business's list.
 * Body: { creator_username: string }
 *
 * Ownership enforced: deletes only where business_user_id = userId_from_key.
 * A developer cannot remove from another organisation's list.
 */
export async function DELETE(req: NextRequest) {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  let body: { creator_username?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const creator_username = body.creator_username?.trim().toLowerCase();
  if (!creator_username) return NextResponse.json({ error: "creator_username is required" }, { status: 400 });

  // Both conditions must match — userId_from_key AND the username
  const { error } = await adminClient
    .from("saved_creators")
    .delete()
    .eq("business_user_id", userId)   // ownership enforced
    .eq("creator_username", creator_username);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: false });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
