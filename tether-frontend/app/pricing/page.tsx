"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { SubscriptionPlan, FeatureDefinition, PlanFeature } from "@/lib/api";
import { api, ApiError } from "@/lib/api";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

type PlanWithFeatures = SubscriptionPlan & { features: PlanFeature[] };

const TIER_ORDER = ["Starter", "Specialist", "Growth", "Enterprise"];

function formatPrice(cents: number, period: "monthly" | "annual"): string {
  if (cents === 0) return "Free";
  const monthly = period === "annual" ? cents / 12 : cents;
  return `$${(monthly / 100).toFixed(0)}/mo`;
}

function formatAnnualNote(cents: number, period: "monthly" | "annual"): string | null {
  if (cents === 0 || period === "monthly") return null;
  return `Billed $${(cents / 100).toFixed(0)}/year`;
}

const TIER_COLORS: Record<string, string> = {
  Starter:    "#4a5568",
  Specialist: "#2b6cb0",
  Growth:     "#276749",
  Enterprise: "#6b21a8",
};

const TIER_BG: Record<string, string> = {
  Starter:    "#1a202c",
  Specialist: "#1a365d",
  Growth:     "#1c4532",
  Enterprise: "#2d1b69",
};

export default function PricingPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"creator" | "business">("creator");
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [featureDefs, setFeatureDefs] = useState<FeatureDefinition[]>([]);
  const [salesEmail, setSalesEmail] = useState("sales@tether.so");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [plansRes, settingsRes] = await Promise.all([
          fetch(`${BACKEND}/api/subscriptions/plans`).then((r) => r.json()),
          fetch(`${BACKEND}/api/admin/settings`).then((r) => r.json()).catch(() => ({ settings: [] })),
        ]);
        setPlans(plansRes.plans ?? []);
        setFeatureDefs(plansRes.feature_definitions ?? []);
        const emailSetting = (settingsRes.settings ?? []).find((s: { key: string }) => s.key === "sales_email");
        if (emailSetting) setSalesEmail(emailSetting.value);
      } catch {
        setError("Failed to load plans");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSelect = useCallback(async (plan: PlanWithFeatures) => {
    if (plan.is_enterprise) {
      window.location.href = `mailto:${salesEmail}?subject=Tether Enterprise Enquiry&body=Hi, I'm interested in Tether's Enterprise plan for ${plan.user_type}s.`;
      return;
    }
    if (plan.is_free) {
      router.push("/signup");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push(`/login?redirect=/pricing`);
      return;
    }

    setCheckingOut(plan.id);
    try {
      const res = await api.subscriptions.checkout(plan.id);
      if (res.url) window.location.href = res.url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Checkout failed");
      setCheckingOut(null);
    }
  }, [salesEmail, router]);

  const filteredPlans = plans
    .filter((p) => p.user_type === tab && p.billing_period === billing)
    .sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name));

  const relevantFeatures = featureDefs.filter((f) => f.user_type === tab || f.user_type === "any");

  const getFeature = (plan: PlanWithFeatures, featureKey: string): PlanFeature | undefined =>
    plan.features.find((f) => f.feature_key === featureKey);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#94a3b8", fontFamily: "sans-serif" }}>Loading plans…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", fontFamily: "sans-serif", color: "#e2e8f0" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e293b", padding: "1rem 2rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "0.9rem" }}>← Back</button>
        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "#e2e8f0" }}>Tether Pricing</span>
        <div />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "3rem 1.5rem" }}>
        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0, background: "linear-gradient(135deg, #60a5fa, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Simple, transparent pricing
          </h1>
          <p style={{ color: "#94a3b8", marginTop: "0.75rem", fontSize: "1.1rem" }}>
            Start free. Upgrade as you grow.
          </p>
        </div>

        {error && (
          <div style={{ background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", color: "#fca5a5", textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Role tab */}
        <div style={{ display: "flex", justifyContent: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
          {(["creator", "business"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "0.5rem 1.5rem", borderRadius: 999, border: "1px solid",
              borderColor: tab === t ? "#60a5fa" : "#334155",
              background: tab === t ? "#1e3a5f" : "transparent",
              color: tab === t ? "#60a5fa" : "#94a3b8",
              cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", textTransform: "capitalize",
            }}>
              {t}s
            </button>
          ))}
        </div>

        {/* Billing toggle */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
          <span style={{ color: billing === "monthly" ? "#e2e8f0" : "#64748b", fontWeight: 500 }}>Monthly</span>
          <button
            onClick={() => setBilling(billing === "monthly" ? "annual" : "monthly")}
            style={{
              width: 52, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
              background: billing === "annual" ? "#3b82f6" : "#334155",
              position: "relative", transition: "background 0.2s",
            }}
          >
            <span style={{
              position: "absolute", top: 4, left: billing === "annual" ? 28 : 4,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s",
            }} />
          </button>
          <span style={{ color: billing === "annual" ? "#e2e8f0" : "#64748b", fontWeight: 500 }}>
            Annual <span style={{ color: "#34d399", fontSize: "0.8rem", marginLeft: 4 }}>Save ~20%</span>
          </span>
        </div>

        {/* Plan cards */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(filteredPlans.length, 4)}, 1fr)`, gap: "1.25rem", marginBottom: "4rem" }}>
          {filteredPlans.map((plan) => {
            const isBestValue = plan.name === "Growth";
            return (
              <div key={plan.id} style={{
                background: TIER_BG[plan.name] ?? "#1e293b",
                border: `1px solid ${isBestValue ? "#3b82f6" : "#334155"}`,
                borderRadius: 16, padding: "1.75rem 1.5rem",
                position: "relative", display: "flex", flexDirection: "column",
              }}>
                {isBestValue && (
                  <div style={{
                    position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                    background: "#3b82f6", color: "#fff", fontSize: "0.75rem", fontWeight: 700,
                    padding: "0.25rem 0.75rem", borderRadius: 999, whiteSpace: "nowrap",
                  }}>
                    Most Popular
                  </div>
                )}

                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: "50%",
                      background: TIER_COLORS[plan.name] ?? "#4a5568", display: "inline-block",
                    }} />
                    <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>{plan.name}</span>
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 800, color: "#f1f5f9" }}>
                    {plan.is_enterprise ? "Custom" : formatPrice(plan.price_cents, billing)}
                  </div>
                  {formatAnnualNote(plan.price_cents, billing) && (
                    <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                      {formatAnnualNote(plan.price_cents, billing)}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSelect(plan)}
                  disabled={!!checkingOut}
                  style={{
                    padding: "0.65rem", borderRadius: 8, cursor: checkingOut ? "wait" : "pointer",
                    background: plan.is_enterprise ? "transparent" : (isBestValue ? "#3b82f6" : "#334155"),
                    border: plan.is_enterprise ? "1px solid #6d28d9" : "none",
                    color: plan.is_enterprise ? "#a78bfa" : "#fff",
                    fontWeight: 600, marginBottom: "1.5rem",
                    opacity: checkingOut && checkingOut !== plan.id ? 0.5 : 1,
                  } as React.CSSProperties}
                >
                  {checkingOut === plan.id ? "Redirecting…" :
                   plan.is_enterprise ? "Contact Sales" :
                   plan.is_free ? "Get Started Free" : "Upgrade"}
                </button>

                {/* Feature list */}
                <div style={{ flex: 1 }}>
                  {relevantFeatures.slice(0, 8).map((fd) => {
                    const pf = getFeature(plan, fd.key);
                    const enabled = pf?.is_enabled ?? false;
                    return (
                      <div key={fd.key} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ color: enabled ? "#34d399" : "#475569", marginTop: 1, flexShrink: 0 }}>
                          {enabled ? "✓" : "–"}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: enabled ? "#cbd5e1" : "#475569" }}>
                          {fd.label}
                          {enabled && pf?.rate_limit != null && (
                            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}> ({pf.rate_limit}/{pf.rate_period})</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise section */}
        <div style={{
          background: "linear-gradient(135deg, #2d1b69, #1a365d)",
          border: "1px solid #4c1d95", borderRadius: 16, padding: "2.5rem",
          textAlign: "center",
        }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Need something bigger?</h2>
          <p style={{ color: "#94a3b8", margin: "0 0 1.5rem" }}>
            Enterprise plans include unlimited usage, priority support, custom integrations, and a dedicated account manager.
          </p>
          <a
            href={`mailto:${salesEmail}?subject=Tether Enterprise Enquiry`}
            style={{
              display: "inline-block", padding: "0.75rem 2rem", borderRadius: 8,
              background: "#6d28d9", color: "#fff", fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Talk to Sales → {salesEmail}
          </a>
        </div>
      </div>
    </div>
  );
}
