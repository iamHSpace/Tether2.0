import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/admin/subscriptions/plans
 * Returns all plans with their feature config.
 *
 * PATCH /api/admin/subscriptions/plans
 * Body: { id, price_cents?, stripe_price_id?, is_active? }
 * Update a single plan's price/stripe config/visibility.
 */
export async function GET(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  const { data: plans, error } = await adminClient
    .from("subscription_plans")
    .select("*")
    .order("user_type").order("price_cents");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const planIds = (plans ?? []).map((p) => p.id);
  const { data: features } = await adminClient
    .from("plan_features")
    .select("plan_id, feature_key, is_enabled, rate_limit, rate_period")
    .in("plan_id", planIds);

  const featuresByPlan: Record<string, typeof features> = {};
  for (const f of features ?? []) {
    (featuresByPlan[f.plan_id] ??= []).push(f);
  }

  return NextResponse.json({
    plans: (plans ?? []).map((p) => ({ ...p, features: featuresByPlan[p.id] ?? [] })),
  });
}

export async function PATCH(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  let body: { id?: string; price_cents?: number; stripe_price_id?: string; is_active?: boolean };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, ...patch } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed: (keyof typeof patch)[] = ["price_cents", "stripe_price_id", "is_active"];
  const update: Partial<typeof patch> = {};
  for (const k of allowed) {
    if (patch[k] !== undefined) update[k] = patch[k] as never;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const { data, error } = await adminClient
    .from("subscription_plans")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
