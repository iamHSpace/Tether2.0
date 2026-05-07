"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import type { SubscriptionPlan, FeatureDefinition, PlanFeature } from "@/lib/api";

type PlanWithFeatures = SubscriptionPlan & { features: PlanFeature[] };

const TIER_ORDER = ["Starter", "Specialist", "Growth", "Enterprise"];
const USER_TYPES = ["creator", "business"] as const;
const BILLING_PERIODS = ["monthly", "annual"] as const;

export default function AdminSubscriptionsPage() {
  const [plans, setPlans] = useState<PlanWithFeatures[]>([]);
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedUserType, setSelectedUserType] = useState<"creator" | "business">("creator");
  const [selectedBilling, setSelectedBilling] = useState<"monthly" | "annual">("monthly");

  async function load() {
    setLoading(true);
    try {
      const [plansRes, featuresRes] = await Promise.all([
        api.adminSubscriptions.plans(),
        api.adminSubscriptions.features(),
      ]);
      setPlans(plansRes.plans ?? []);
      setFeatures(featuresRes.features ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredPlans = plans
    .filter((p) => p.user_type === selectedUserType && p.billing_period === selectedBilling)
    .sort((a, b) => TIER_ORDER.indexOf(a.name) - TIER_ORDER.indexOf(b.name));

  const relevantFeatures = features
    .filter((f) => f.user_type === selectedUserType || f.user_type === "any")
    .sort((a, b) => a.sort_order - b.sort_order);

  const getFeature = (plan: PlanWithFeatures, key: string): PlanFeature | undefined =>
    plan.features.find((f) => f.feature_key === key);

  const handleUpdatePlan = useCallback(async (plan: PlanWithFeatures, field: "price_cents" | "stripe_price_id", value: string) => {
    const patch = field === "price_cents"
      ? { price_cents: parseInt(value) || 0 }
      : { stripe_price_id: value || null };

    setSaving(`plan-${plan.id}-${field}`);
    setError(null);
    try {
      await api.adminSubscriptions.updatePlan(plan.id, patch as { price_cents?: number; stripe_price_id?: string });
      setSuccess(`${plan.name} ${plan.billing_period} updated`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update plan");
    } finally {
      setSaving(null);
    }
  }, []);

  const handleToggleFeature = useCallback(async (planId: string, featureKey: string, currentEnabled: boolean) => {
    setSaving(`${planId}-${featureKey}-enabled`);
    setError(null);
    try {
      await api.adminSubscriptions.updateFeature({ plan_id: planId, feature_key: featureKey, is_enabled: !currentEnabled });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update feature");
    } finally {
      setSaving(null);
    }
  }, []);

  const handleRateLimit = useCallback(async (planId: string, featureKey: string, value: string, period: string) => {
    const rateLimit = value === "" ? null : parseInt(value);
    setSaving(`${planId}-${featureKey}-rate`);
    setError(null);
    try {
      await api.adminSubscriptions.updateFeature({ plan_id: planId, feature_key: featureKey, rate_limit: rateLimit, rate_period: period });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update rate limit");
    } finally {
      setSaving(null);
    }
  }, []);

  if (loading) return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "sans-serif" }}>Loading…</div>;

  return (
    <div style={{ padding: "1.5rem 2rem", fontFamily: "sans-serif", color: "#e2e8f0" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" }}>Subscription Plans</h1>
      <p style={{ color: "#94a3b8", margin: "0 0 1.5rem", fontSize: "0.9rem" }}>
        Configure plan prices, Stripe price IDs, and feature access per plan.
      </p>

      {error && <div style={{ background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "#fca5a5", fontSize: "0.875rem" }}>{error}</div>}
      {success && <div style={{ background: "#14532d", border: "1px solid #166534", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "#86efac", fontSize: "0.875rem" }}>{success}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {USER_TYPES.map((t) => (
          <button key={t} onClick={() => setSelectedUserType(t)} style={{
            padding: "0.4rem 1rem", borderRadius: 999, border: "1px solid",
            borderColor: selectedUserType === t ? "#60a5fa" : "#334155",
            background: selectedUserType === t ? "#1e3a5f" : "transparent",
            color: selectedUserType === t ? "#60a5fa" : "#94a3b8",
            cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", textTransform: "capitalize",
          }}>{t}s</button>
        ))}
        {BILLING_PERIODS.map((b) => (
          <button key={b} onClick={() => setSelectedBilling(b)} style={{
            padding: "0.4rem 1rem", borderRadius: 999, border: "1px solid",
            borderColor: selectedBilling === b ? "#a78bfa" : "#334155",
            background: selectedBilling === b ? "#2d1b69" : "transparent",
            color: selectedBilling === b ? "#a78bfa" : "#94a3b8",
            cursor: "pointer", fontWeight: 600, fontSize: "0.85rem", textTransform: "capitalize",
          }}>{b}</button>
        ))}
      </div>

      {/* Plan pricing table */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, marginBottom: "2rem", overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #334155", fontWeight: 600, fontSize: "0.9rem", color: "#94a3b8" }}>
          Plan Pricing & Stripe Config
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={th}>Plan</th>
              <th style={th}>Price (cents)</th>
              <th style={th}>Monthly equiv.</th>
              <th style={th}>Stripe Price ID</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPlans.map((plan) => (
              <tr key={plan.id} style={{ borderTop: "1px solid #1e293b" }}>
                <td style={td}><span style={{ fontWeight: 600 }}>{plan.name}</span></td>
                <td style={td}>
                  {plan.is_enterprise || plan.is_free ? (
                    <span style={{ color: "#64748b" }}>{plan.is_free ? "Free" : "Custom"}</span>
                  ) : (
                    <PriceInput
                      value={String(plan.price_cents)}
                      saving={saving === `plan-${plan.id}-price_cents`}
                      onSave={(v) => handleUpdatePlan(plan, "price_cents", v)}
                    />
                  )}
                </td>
                <td style={td}>
                  <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>
                    {plan.is_enterprise ? "—" : plan.is_free ? "$0" :
                      selectedBilling === "annual"
                        ? `$${(plan.price_cents / 12 / 100).toFixed(2)}/mo`
                        : `$${(plan.price_cents / 100).toFixed(2)}/mo`}
                  </span>
                </td>
                <td style={td}>
                  {plan.is_free || plan.is_enterprise ? (
                    <span style={{ color: "#64748b", fontSize: "0.85rem" }}>N/A</span>
                  ) : (
                    <PriceInput
                      value={plan.stripe_price_id ?? ""}
                      placeholder="price_1..."
                      saving={saving === `plan-${plan.id}-stripe_price_id`}
                      onSave={(v) => handleUpdatePlan(plan, "stripe_price_id", v)}
                      mono
                    />
                  )}
                </td>
                <td style={td}>
                  <span style={{
                    padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem", fontWeight: 600,
                    background: plan.is_active ? "#14532d" : "#451a03",
                    color: plan.is_active ? "#86efac" : "#fed7aa",
                  }}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feature matrix */}
      <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, overflow: "auto" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #334155", fontWeight: 600, fontSize: "0.9rem", color: "#94a3b8" }}>
          Feature Configuration
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
          <thead>
            <tr style={{ background: "#0f172a" }}>
              <th style={{ ...th, textAlign: "left", minWidth: 200 }}>Feature</th>
              {filteredPlans.map((p) => (
                <th key={p.id} style={{ ...th, minWidth: 160 }}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {relevantFeatures.map((fd) => (
              <tr key={fd.key} style={{ borderTop: "1px solid #0f172a" }}>
                <td style={{ ...td, textAlign: "left" }}>
                  <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{fd.label}</div>
                  {fd.description && <div style={{ color: "#64748b", fontSize: "0.75rem" }}>{fd.description}</div>}
                </td>
                {filteredPlans.map((plan) => {
                  const pf = getFeature(plan, fd.key);
                  const isEnabled = pf?.is_enabled ?? false;
                  const key = `${plan.id}-${fd.key}`;
                  return (
                    <td key={plan.id} style={{ ...td, verticalAlign: "top" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                        {/* Toggle */}
                        <button
                          onClick={() => handleToggleFeature(plan.id, fd.key, isEnabled)}
                          disabled={saving === `${key}-enabled`}
                          style={{
                            padding: "0.25rem 0.6rem", borderRadius: 6, border: "none", cursor: "pointer",
                            background: isEnabled ? "#14532d" : "#451a03",
                            color: isEnabled ? "#86efac" : "#fed7aa",
                            fontWeight: 600, fontSize: "0.8rem", opacity: saving === `${key}-enabled` ? 0.5 : 1,
                          }}
                        >
                          {saving === `${key}-enabled` ? "…" : isEnabled ? "Enabled" : "Disabled"}
                        </button>
                        {/* Rate limit */}
                        {isEnabled && (
                          <RateLimitInput
                            value={pf?.rate_limit ?? null}
                            period={pf?.rate_period ?? "day"}
                            saving={saving === `${key}-rate`}
                            onSave={(v, p) => handleRateLimit(plan.id, fd.key, v, p)}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PriceInput({ value, placeholder, saving, onSave, mono = false }: {
  value: string; placeholder?: string; saving: boolean;
  onSave: (v: string) => void; mono?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div style={{ display: "flex", gap: "0.35rem" }}>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
          color: "#e2e8f0", padding: "0.3rem 0.5rem", fontSize: mono ? "0.75rem" : "0.875rem",
          fontFamily: mono ? "monospace" : "inherit", width: mono ? 160 : 90,
        }}
      />
      <button
        onClick={() => onSave(local)}
        disabled={saving || local === value}
        style={{
          background: "#1d4ed8", border: "none", borderRadius: 6, color: "#fff",
          padding: "0.3rem 0.6rem", cursor: "pointer", fontSize: "0.8rem",
          opacity: saving || local === value ? 0.5 : 1,
        }}
      >
        {saving ? "…" : "Save"}
      </button>
    </div>
  );
}

function RateLimitInput({ value, period, saving, onSave }: {
  value: number | null; period: string; saving: boolean;
  onSave: (v: string, period: string) => void;
}) {
  const [localVal, setLocalVal] = useState(value === null ? "" : String(value));
  const [localPeriod, setLocalPeriod] = useState(period);
  useEffect(() => { setLocalVal(value === null ? "" : String(value)); setLocalPeriod(period); }, [value, period]);

  const isDirty = localVal !== (value === null ? "" : String(value)) || localPeriod !== period;

  return (
    <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
      <input
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        placeholder="∞"
        style={{
          background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
          color: "#e2e8f0", padding: "0.2rem 0.4rem", fontSize: "0.8rem", width: 55,
        }}
      />
      <select
        value={localPeriod}
        onChange={(e) => setLocalPeriod(e.target.value)}
        style={{
          background: "#0f172a", border: "1px solid #334155", borderRadius: 6,
          color: "#94a3b8", padding: "0.2rem 0.3rem", fontSize: "0.75rem",
        }}
      >
        <option value="hour">/ hr</option>
        <option value="day">/ day</option>
        <option value="month">/ mo</option>
      </select>
      {isDirty && (
        <button
          onClick={() => onSave(localVal, localPeriod)}
          disabled={saving}
          style={{
            background: "#1d4ed8", border: "none", borderRadius: 6, color: "#fff",
            padding: "0.2rem 0.45rem", cursor: "pointer", fontSize: "0.75rem",
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "…" : "✓"}
        </button>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "0.6rem 0.875rem", textAlign: "center",
  color: "#94a3b8", fontWeight: 600, fontSize: "0.8rem",
  borderBottom: "1px solid #334155",
};
const td: React.CSSProperties = {
  padding: "0.75rem 0.875rem", textAlign: "center",
  fontSize: "0.875rem", color: "#e2e8f0",
};
