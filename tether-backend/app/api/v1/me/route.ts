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
 * GET /api/v1/me
 *
 * @openapi
 * tags: [v1]
 * summary: Get authenticated creator's own profile
 * description: |
 *   Returns the full profile and latest metrics for the creator whose API key
 *   is used to authenticate. Useful for embedding your Statvora stats in external
 *   dashboards or automations.
 *
 * Authentication: Bearer stv_<key>
 */
export async function GET(req: NextRequest) {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, username, company_name, full_name, bio, website, avatar_url, user_type, updated_at")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

/**
 * PATCH /api/v1/me
 *
 * Update the authenticated business's own profile.
 * Only fields supplied in the body are updated — all others are left unchanged.
 *
 * Editable fields: company_name, bio, website
 *
 * Ownership is enforced structurally: the UPDATE is filtered by
 * .eq("id", userId) where userId comes from the API key, so it is
 * impossible to modify another organisation's profile.
 */
export async function PATCH(req: NextRequest) {
  const result = await resolveUser(req);
  if (result instanceof NextResponse) return result;
  const { userId } = result;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allow only safe, business-relevant fields — never user_type, is_admin, etc.
  const ALLOWED: (keyof typeof body)[] = ["company_name", "bio", "website"];
  const patch: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in body) {
      const val = body[key];
      if (typeof val !== "string" && val !== null) {
        return NextResponse.json({ error: `${key} must be a string or null` }, { status: 400 });
      }
      patch[key] = typeof val === "string" ? val.trim() : null;
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields provided. Allowed: company_name, bio, website" }, { status: 400 });
  }

  // .eq("id", userId) ensures only their own row is updated — never another org's
  const { data, error } = await adminClient
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("id, username, company_name, bio, website, updated_at")
    .single();

  if (error || !data) return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
