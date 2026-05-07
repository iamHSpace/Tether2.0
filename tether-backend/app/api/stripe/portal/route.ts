import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { requireStripe } from "@/lib/stripe";

const FRONTEND_URL = process.env.FRONTEND_URL ?? "https://tether-frontend.vercel.app";

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so users can manage their subscription.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: sub } = await adminClient
    .from("user_subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription found" }, { status: 400 });
  }

  const stripe = requireStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${FRONTEND_URL}/settings?tab=subscription`,
  });

  return NextResponse.json({ url: session.url });
}
