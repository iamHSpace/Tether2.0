import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/admin/subscriptions/features
 * Returns all feature definitions.
 *
 * PUT /api/admin/subscriptions/features
 * Body: { plan_id, feature_key, is_enabled, rate_limit, rate_period }
 * Upsert a single plan→feature row.
 */
export async function GET(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  const { data, error } = await adminClient
    .from("feature_definitions")
    .select("*")
    .order("sort_order");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ features: data ?? [] });
}

export async function PUT(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  let body: {
    plan_id?: string;
    feature_key?: string;
    is_enabled?: boolean;
    rate_limit?: number | null;
    rate_period?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { plan_id, feature_key, is_enabled, rate_limit, rate_period } = body;
  if (!plan_id || !feature_key) return NextResponse.json({ error: "plan_id and feature_key are required" }, { status: 400 });

  const row = {
    plan_id,
    feature_key,
    ...(is_enabled !== undefined ? { is_enabled } : {}),
    ...(rate_limit !== undefined ? { rate_limit } : {}),
    ...(rate_period !== undefined ? { rate_period } : {}),
  };

  const { data, error } = await adminClient
    .from("plan_features")
    .upsert(row, { onConflict: "plan_id,feature_key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feature: data });
}
