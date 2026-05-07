import { NextRequest, NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";
import { requireStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const config = { api: { bodyParser: false } };

/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events to keep user_subscriptions in sync.
 * Verifies signature using STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const stripe = requireStripe();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig ?? "", webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature failed: ${(err as Error).message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;

      const userId  = session.metadata?.user_id;
      const planId  = session.metadata?.plan_id;
      const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);

      if (userId && planId) {
        await upsertSubscription(userId, planId, session.customer as string, stripeSub);
      }
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const userId = stripeSub.metadata?.user_id;
      const planId = stripeSub.metadata?.plan_id;
      if (userId && planId) {
        await upsertSubscription(userId, planId, stripeSub.customer as string, stripeSub);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const userId = stripeSub.metadata?.user_id;
      if (userId) {
        await adminClient
          .from("user_subscriptions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("user_id", userId);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as unknown as { subscription?: string }).subscription;
      if (subId) {
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        const userId = stripeSub.metadata?.user_id;
        if (userId) {
          await adminClient
            .from("user_subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function upsertSubscription(userId: string, planId: string, customerId: string, stripeSub: Stripe.Subscription) {
  await adminClient.from("user_subscriptions").upsert(
    {
      user_id:                userId,
      plan_id:                planId,
      stripe_customer_id:     customerId,
      stripe_subscription_id: stripeSub.id,
      status:                 stripeSub.status,
      current_period_start:   new Date((stripeSub.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
      current_period_end:     new Date((stripeSub.items.data[0]?.current_period_end   ?? 0) * 1000).toISOString(),
      cancel_at_period_end:   stripeSub.cancel_at_period_end,
      updated_at:             new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}
