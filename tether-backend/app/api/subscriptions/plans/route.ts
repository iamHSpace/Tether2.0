import { NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";

const CORS = { "Access-Control-Allow-Origin": "*" };

/**
 * GET /api/subscriptions/plans
 *
 * Public endpoint — returns all active plans with their feature lists.
 * Used by the pricing page (no auth required).
 */
export async function GET() {
  const { data: plans, error } = await adminClient
    .from("subscription_plans")
    .select("id, name, user_type, billing_period, price_cents, is_free, is_enterprise, is_active")
    .eq("is_active", true)
    .order("user_type")
    .order("price_cents");

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

  const planIds = (plans ?? []).map((p) => p.id);

  const { data: features } = await adminClient
    .from("plan_features")
    .select("plan_id, feature_key, is_enabled, rate_limit, rate_period")
    .in("plan_id", planIds);

  const { data: featureDefs } = await adminClient
    .from("feature_definitions")
    .select("key, label, description, user_type, category, sort_order")
    .order("sort_order");

  const featuresByPlan: Record<string, typeof features> = {};
  for (const f of features ?? []) {
    (featuresByPlan[f.plan_id] ??= []).push(f);
  }

  const result = (plans ?? []).map((p) => ({
    ...p,
    features: featuresByPlan[p.id] ?? [],
  }));

  return NextResponse.json(
    { plans: result, feature_definitions: featureDefs ?? [] },
    { headers: { ...CORS, "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
