import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { generateKey } from "@/lib/apiKeyGuard";

/**
 * GET /api/developer/keys
 *
 * List all API keys for the authenticated user.
 * Raw keys are never returned — only metadata + prefix for display.
 */
async function requireBusiness(userId: string): Promise<boolean> {
  const { data } = await adminClient
    .from("profiles")
    .select("user_type")
    .eq("id", userId)
    .single();
  return data?.user_type === "business";
}

export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await requireBusiness(user.id)) return NextResponse.json({ error: "API keys are only available to business accounts" }, { status: 403 });

  const { data, error } = await adminClient
    .from("api_keys")
    .select("id, name, key_prefix, created_at, last_used_at, expires_at, is_active")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data ?? [] });
}

/**
 * POST /api/developer/keys
 *
 * Create a new API key.
 * Body: { name: string, expires_at?: string (ISO 8601) }
 *
 * Returns the raw key ONCE — it cannot be recovered after this response.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await requireBusiness(user.id)) return NextResponse.json({ error: "API keys are only available to business accounts" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "name too long (max 100 chars)" }, { status: 400 });

  const expires_at = body.expires_at ?? null;

  // Enforce per-user key limit (max 10 active keys)
  const { count } = await adminClient
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Maximum of 10 active API keys allowed. Revoke an existing key first." }, { status: 429 });
  }

  const { raw, hash, prefix } = generateKey();

  const { data, error } = await adminClient
    .from("api_keys")
    .insert({ user_id: user.id, name, key_hash: hash, key_prefix: prefix, expires_at })
    .select("id, name, key_prefix, created_at, expires_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key: { ...data, raw_key: raw } }, { status: 201 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
