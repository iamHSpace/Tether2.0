import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { requireStripe } from "@/lib/stripe";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://statvora.in";

/**
 * POST /api/stripe/checkout
 * Body: { plan_id: string }
 *
 * Creates a Stripe Checkout session for the given plan.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plan_id?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.plan_id) return NextResponse.json({ error: "plan_id is required" }, { status: 400 });

  const { data: plan } = await adminClient
    .from("subscription_plans")
    .select("id, name, stripe_price_id, is_free, is_enterprise, price_cents")
    .eq("id", body.plan_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  if (plan.is_enterprise) return NextResponse.json({ error: "Contact sales for Enterprise" }, { status: 400 });
  if (plan.is_free) return NextResponse.json({ error: "Free plan requires no checkout" }, { status: 400 });
  if (!plan.stripe_price_id) return NextResponse.json({ error: "Stripe price not configured for this plan" }, { status: 400 });

  const stripe = requireStripe();

  // Find or create Stripe customer
  const { data: sub } = await adminClient
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { user_id: user.id } });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${FRONTEND_URL}/settings?tab=subscription&checkout=success`,
    cancel_url:  `${FRONTEND_URL}/pricing?checkout=cancelled`,
    metadata: { user_id: user.id, plan_id: plan.id },
    subscription_data: { metadata: { user_id: user.id, plan_id: plan.id } },
  });

  return NextResponse.json({ url: session.url });
}
