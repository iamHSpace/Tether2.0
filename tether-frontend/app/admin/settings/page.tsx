"use client";

import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api";
import type { PlatformSetting } from "@/lib/api";

const SETTING_LABELS: Record<string, { label: string; description: string; type?: "email" | "text" | "toggle" }> = {
  sales_email:    { label: "Sales / Enterprise Email", description: "Email shown on the pricing page for Enterprise plan enquiries", type: "email" },
  stripe_enabled: { label: "Stripe Payments Enabled", description: 'Set to "true" to enable Stripe checkout (requires STRIPE_SECRET_KEY on backend)', type: "toggle" },
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.adminSubscriptions.settings();
      setSettings(res.settings ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleSave = useCallback(async (key: string, value: string) => {
    setSaving(key);
    setError(null);
    try {
      await api.adminSubscriptions.updateSetting(key, value);
      setSuccess(`${SETTING_LABELS[key]?.label ?? key} saved`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setSaving(null);
    }
  }, []);

  if (loading) return <div style={{ padding: "2rem", color: "#94a3b8", fontFamily: "sans-serif" }}>Loading…</div>;

  return (
    <div style={{ padding: "1.5rem 2rem", fontFamily: "sans-serif", color: "#e2e8f0", maxWidth: 700 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: "0.25rem" }}>Platform Settings</h1>
      <p style={{ color: "#94a3b8", margin: "0 0 1.5rem", fontSize: "0.9rem" }}>
        Admin-configurable global settings.
      </p>

      {error && <div style={{ background: "#7f1d1d", border: "1px solid #991b1b", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "#fca5a5", fontSize: "0.875rem" }}>{error}</div>}
      {success && <div style={{ background: "#14532d", border: "1px solid #166534", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", color: "#86efac", fontSize: "0.875rem" }}>{success}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {settings.map((setting) => (
          <SettingRow
            key={setting.key}
            setting={setting}
            meta={SETTING_LABELS[setting.key]}
            saving={saving === setting.key}
            onSave={(v) => handleSave(setting.key, v)}
          />
        ))}
      </div>

      <div style={{ marginTop: "2rem", background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>Environment Variables</h3>
        <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "0 0 0.75rem" }}>
          These must be set in your Vercel backend environment — they cannot be changed here.
        </p>
        {[
          { key: "STRIPE_SECRET_KEY", desc: "Stripe secret key (sk_live_... or sk_test_...)" },
          { key: "STRIPE_WEBHOOK_SECRET", desc: "Stripe webhook signing secret (whsec_...)" },
          { key: "NEXT_PUBLIC_APP_URL", desc: "Backend public URL" },
          { key: "FRONTEND_URL", desc: "Frontend URL for redirect after checkout" },
        ].map(({ key, desc }) => (
          <div key={key} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <code style={{ background: "#0f172a", padding: "0.2rem 0.5rem", borderRadius: 4, fontSize: "0.8rem", color: "#7dd3fc", minWidth: 260 }}>{key}</code>
            <span style={{ color: "#64748b", fontSize: "0.8rem" }}>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingRow({ setting, meta, saving, onSave }: {
  setting: PlatformSetting;
  meta?: { label: string; description: string; type?: "email" | "text" | "toggle" };
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [local, setLocal] = useState(setting.value);
  useEffect(() => setLocal(setting.value), [setting.value]);

  const isToggle = meta?.type === "toggle";
  const isDirty = local !== setting.value;

  return (
    <div style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 12, padding: "1.25rem" }}>
      <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>{meta?.label ?? setting.key}</div>
      {meta?.description && <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{meta.description}</div>}

      {isToggle ? (
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={() => { const v = local === "true" ? "false" : "true"; setLocal(v); onSave(v); }}
            disabled={saving}
            style={{
              width: 52, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
              background: local === "true" ? "#3b82f6" : "#334155", position: "relative",
              opacity: saving ? 0.5 : 1,
            }}
          >
            <span style={{
              position: "absolute", top: 4, left: local === "true" ? 28 : 4,
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              transition: "left 0.2s",
            }} />
          </button>
          <span style={{ fontSize: "0.875rem", color: local === "true" ? "#86efac" : "#94a3b8" }}>
            {local === "true" ? "Enabled" : "Disabled"}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type={meta?.type === "email" ? "email" : "text"}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            style={{
              flex: 1, background: "#0f172a", border: "1px solid #334155", borderRadius: 8,
              color: "#e2e8f0", padding: "0.5rem 0.75rem", fontSize: "0.9rem",
            }}
          />
          <button
            onClick={() => onSave(local)}
            disabled={saving || !isDirty}
            style={{
              background: "#1d4ed8", border: "none", borderRadius: 8, color: "#fff",
              padding: "0.5rem 1rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem",
              opacity: saving || !isDirty ? 0.5 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      <div style={{ color: "#475569", fontSize: "0.75rem", marginTop: "0.5rem" }}>
        Last updated: {new Date(setting.updated_at).toLocaleString()}
      </div>
    </div>
  );
}
