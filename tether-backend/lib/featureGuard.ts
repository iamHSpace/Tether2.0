/**
 * lib/featureGuard.ts
 *
 * Check whether a user can access a feature, honouring their subscription plan
 * and any rate limits configured by the admin.
 *
 * Usage:
 *   const result = await checkFeatureAccess(userId, "business_discover_creators");
 *   if (!result.allowed) return NextResponse.json({ error: result.reason }, { status: result.status });
 */

import { supabase as adminClient } from "@/lib/supabase";

type PeriodUnit = "hour" | "day" | "month";

function periodStart(unit: PeriodUnit): string {
  const now = new Date();
  if (unit === "hour") {
    now.setMinutes(0, 0, 0);
  } else if (unit === "day") {
    now.setHours(0, 0, 0, 0);
  } else {
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
  }
  return now.toISOString();
}

export type AccessResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; reason: string; status: 403 | 429 };

/**
 * Check access and optionally increment usage counter.
 * Pass `increment: false` to check-only without counting (e.g., for read-only checks).
 */
export async function checkFeatureAccess(
  userId: string,
  featureKey: string,
  increment = true
): Promise<AccessResult> {
  // 1. Get user's active subscription plan
  const { data: sub } = await adminClient
    .from("user_subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  // Users with no subscription row fall through to Starter plan for their user_type
  let planId: string | null = sub?.plan_id ?? null;

  if (!planId) {
    // Determine user type
    const { data: profile } = await adminClient
      .from("profiles")
      .select("user_type")
      .eq("id", userId)
      .maybeSingle();

    const userType = profile?.user_type ?? "creator";

    // Assign free Starter plan
    const { data: starterPlan } = await adminClient
      .from("subscription_plans")
      .select("id")
      .eq("name", "Starter")
      .eq("user_type", userType)
      .eq("billing_period", "monthly")
      .maybeSingle();

    planId = starterPlan?.id ?? null;
  }

  if (!planId) return { allowed: false, reason: "No plan found", status: 403 };

  // 2. Look up feature config for this plan
  const { data: pf } = await adminClient
    .from("plan_features")
    .select("is_enabled, rate_limit, rate_period")
    .eq("plan_id", planId)
    .eq("feature_key", featureKey)
    .maybeSingle();

  if (!pf || !pf.is_enabled) {
    return { allowed: false, reason: "This feature is not available on your current plan. Please upgrade.", status: 403 };
  }

  // 3. No rate limit — immediately allowed
  if (pf.rate_limit === null || pf.rate_limit === undefined) {
    return { allowed: true, remaining: null };
  }

  // 4. Rate-limited feature — check current usage
  const period = periodStart(pf.rate_period as PeriodUnit);

  const { data: usage } = await adminClient
    .from("feature_usage")
    .select("count")
    .eq("user_id", userId)
    .eq("feature_key", featureKey)
    .eq("period_start", period)
    .maybeSingle();

  const currentCount = usage?.count ?? 0;

  if (currentCount >= pf.rate_limit) {
    return {
      allowed: false,
      reason: `Rate limit reached: ${pf.rate_limit} uses per ${pf.rate_period}. Upgrade your plan for higher limits.`,
      status: 429,
    };
  }

  // 5. Increment counter
  if (increment) {
    await adminClient.rpc("increment_feature_usage", {
      p_user_id: userId,
      p_feature_key: featureKey,
      p_period_start: period,
    });
  }

  return { allowed: true, remaining: pf.rate_limit - currentCount - (increment ? 1 : 0) };
}
