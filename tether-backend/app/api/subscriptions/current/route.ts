import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/subscriptions/current
 *
 * Returns the authenticated user's active subscription with plan details.
 * Falls back to Starter plan if no subscription row exists.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await adminClient
    .from("user_subscriptions")
    .select(`
      id, status, current_period_start, current_period_end,
      cancel_at_period_end, stripe_subscription_id,
      plan:subscription_plans (
        id, name, user_type, billing_period, price_cents, is_free, is_enterprise
      )
    `)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub) {
    // Return the Starter plan as the effective plan
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_type")
      .eq("id", user.id)
      .maybeSingle();

    const userType = profile?.user_type ?? "creator";

    const { data: starterPlan } = await adminClient
      .from("subscription_plans")
      .select("id, name, user_type, billing_period, price_cents, is_free, is_enterprise")
      .eq("name", "Starter")
      .eq("user_type", userType)
      .eq("billing_period", "monthly")
      .maybeSingle();

    return NextResponse.json({ subscription: null, effective_plan: starterPlan });
  }

  return NextResponse.json({ subscription: sub, effective_plan: sub.plan });
}
