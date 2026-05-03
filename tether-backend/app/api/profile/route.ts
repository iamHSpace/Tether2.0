import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/profile
 *
 * Returns the authenticated user's own profile row.
 * Creates an empty profile row if one doesn't exist yet.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await adminClient
    .from("profiles")
    .select("id, username, full_name, bio, website, avatar_url, creator_stage, aspiration, platform_reason")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return empty profile shape when not yet created (first visit after signup)
  return NextResponse.json({
    profile: data ?? {
      id: user.id, username: null, full_name: null, bio: null,
      website: null, avatar_url: null, creator_stage: null,
      aspiration: null, platform_reason: null,
    },
    email: user.email ?? null,
  });
}

/**
 * PUT /api/profile
 *
 * Creates or updates the authenticated user's profile.
 * Only the fields sent in the body are written — unknown keys are ignored.
 */
export async function PUT(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Allow only known profile columns — never let the client set id or timestamps
  const ALLOWED = ["username", "full_name", "bio", "website", "avatar_url", "creator_stage", "aspiration", "platform_reason"] as const;
  const update: Record<string, unknown> = { id: user.id };
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key];
  }

  const { data, error } = await adminClient
    .from("profiles")
    .upsert(update, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
