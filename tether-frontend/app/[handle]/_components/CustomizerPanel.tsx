"use client";

/**
 * CustomizerPanel.tsx
 *
 * Floating theme configuration panel — bottom-right corner.
 * Reads / writes the ThemeConfig via the ThemeCtx context.
 */

import { useState } from "react";
import {
  useTheme,
  THEME_META, TYPOGRAPHY_META, PALETTE_META, TEXTURE_META, LAYOUT_META,
  type ThemePreset, type TypographyPreset, type PalettePreset,
  type TexturePreset, type LayoutPreset,
} from "./theme-context";

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background: "rgba(10,12,20,0.96)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "1rem",
  backdropFilter: "blur(20px)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  color: "#e2e8f0",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#475569", marginBottom: 8 }}>
      {children}
    </p>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>{children}</div>;
}

function Chip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        border: active
          ? "1px solid rgba(124,58,237,0.8)"
          : "1px solid rgba(255,255,255,0.1)",
        background: active
          ? "linear-gradient(135deg,rgba(124,58,237,0.35),rgba(236,72,153,0.2))"
          : "rgba(255,255,255,0.04)",
        color: active ? "#e2d9ff" : "#94a3b8",
      }}
    >
      {children}
    </button>
  );
}

function SwatchChip({
  active, swatch, label, onClick,
}: {
  active: boolean;
  swatch: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "5px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        transition: "all 0.15s",
        border: active
          ? "1px solid rgba(124,58,237,0.8)"
          : "1px solid rgba(255,255,255,0.1)",
        background: active
          ? "linear-gradient(135deg,rgba(124,58,237,0.35),rgba(236,72,153,0.2))"
          : "rgba(255,255,255,0.04)",
        color: active ? "#e2d9ff" : "#94a3b8",
      }}
    >
      {/* Colour swatch or gradient */}
      {swatch.startsWith("from-") ? (
        <span
          className={`bg-gradient-to-br ${swatch}`}
          style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: "inline-block", border: "1px solid rgba(255,255,255,0.15)" }}
        />
      ) : (
        <span
          style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            background: swatch,
            border: "1px solid rgba(255,255,255,0.2)",
            display: "inline-block",
          }}
        />
      )}
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────────────────────

export function CustomizerPanel() {
  const [open, setOpen] = useState(false);
  const { config, setTheme, setTypography, setPalette, setTexture, setLayout, resetTheme } = useTheme();

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Customise profile style"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 50,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: open
            ? "linear-gradient(135deg,#7c3aed,#ec4899)"
            : "rgba(15,20,35,0.9)",
          border: "1px solid rgba(255,255,255,0.15)",
          boxShadow: open
            ? "0 0 0 4px rgba(124,58,237,0.25), 0 8px 24px rgba(0,0,0,0.5)"
            : "0 4px 16px rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "all 0.2s",
          backdropFilter: "blur(12px)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          {open ? (
            // × close
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            // palette icon
            <>
              <circle cx="12" cy="12" r="9" />
              <circle cx="9" cy="9.5" r="1.5" fill="white" stroke="none" />
              <circle cx="15" cy="9.5" r="1.5" fill="white" stroke="none" />
              <circle cx="9" cy="14.5" r="1.5" fill="white" stroke="none" />
              <circle cx="15" cy="14.5" r="1.5" fill="white" stroke="none" />
            </>
          )}
        </svg>
      </button>

      {/* Side panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 80,
            right: 24,
            width: 320,
            maxHeight: "calc(100vh - 120px)",
            overflowY: "auto",
            zIndex: 49,
            padding: "20px 20px 16px",
            ...PANEL_STYLE,
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 1 }}>Profile Style</p>
              <p style={{ fontSize: 11, color: "#475569" }}>Customise how this page looks</p>
            </div>
            <button
              onClick={resetTheme}
              style={{
                fontSize: 10, fontWeight: 600, color: "#64748b", cursor: "pointer",
                padding: "3px 8px", borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.07)",
                background: "rgba(255,255,255,0.03)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >
              Reset
            </button>
          </div>

          {/* ── Global Theme ── */}
          <SectionTitle>Global Theme</SectionTitle>
          <Row>
            {(["glassmorphic", "editorial", "brutalist", "arcade"] as ThemePreset[]).map(t => (
              <SwatchChip
                key={t}
                active={config.theme === t}
                swatch={THEME_META[t].swatch}
                label={THEME_META[t].label}
                onClick={() => setTheme(t)}
              />
            ))}
          </Row>
          <p style={{ fontSize: 11, color: "#475569", marginTop: -10, marginBottom: 16 }}>
            {THEME_META[config.theme].desc}
          </p>

          {/* ── Typography ── */}
          <SectionTitle>Typography</SectionTitle>
          <Row>
            {(["minimalist", "sophisticate", "retrotech", "heavyweight"] as TypographyPreset[]).map(t => (
              <Chip key={t} active={config.typography === t} onClick={() => setTypography(t)}>
                {TYPOGRAPHY_META[t].label}
              </Chip>
            ))}
          </Row>
          <p style={{ fontSize: 11, color: "#475569", marginTop: -10, marginBottom: 16 }}>
            {TYPOGRAPHY_META[config.typography].display} · {TYPOGRAPHY_META[config.typography].body} · {TYPOGRAPHY_META[config.typography].mono}
          </p>

          {/* ── Palette ── */}
          <SectionTitle>Colour Palette</SectionTitle>
          <Row>
            {(["deepspace", "alabaster", "monochrome"] as PalettePreset[]).map(p => (
              <SwatchChip
                key={p}
                active={config.palette === p}
                swatch={PALETTE_META[p].swatch}
                label={PALETTE_META[p].label}
                onClick={() => setPalette(p)}
              />
            ))}
          </Row>

          {/* ── Texture ── */}
          <SectionTitle>Background Texture</SectionTitle>
          <Row>
            {(["none", "dots", "graph", "mesh"] as TexturePreset[]).map(t => (
              <Chip key={t} active={config.texture === t} onClick={() => setTexture(t)}>
                {TEXTURE_META[t].icon} {TEXTURE_META[t].label}
              </Chip>
            ))}
          </Row>

          {/* ── Layout ── */}
          <SectionTitle>Layout</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(["asymmetric", "split"] as LayoutPreset[]).map(l => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 7,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                  border: config.layout === l
                    ? "1px solid rgba(124,58,237,0.7)"
                    : "1px solid rgba(255,255,255,0.08)",
                  background: config.layout === l
                    ? "linear-gradient(135deg,rgba(124,58,237,0.25),rgba(236,72,153,0.12))"
                    : "rgba(255,255,255,0.03)",
                }}
              >
                {/* Mini layout diagram */}
                <div style={{ flexShrink: 0 }}>
                  {l === "asymmetric" ? (
                    <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
                      <rect x="1" y="1" width="30" height="8"  rx="2" fill="rgba(124,58,237,0.4)" />
                      <rect x="1" y="11" width="14" height="10" rx="2" fill="rgba(124,58,237,0.25)" />
                      <rect x="17" y="11" width="14" height="4"  rx="2" fill="rgba(124,58,237,0.2)" />
                      <rect x="17" y="17" width="14" height="4"  rx="2" fill="rgba(124,58,237,0.15)" />
                    </svg>
                  ) : (
                    <svg width="32" height="22" viewBox="0 0 32 22" fill="none">
                      <rect x="1" y="1" width="12" height="20" rx="2" fill="rgba(124,58,237,0.35)" />
                      <rect x="15" y="1" width="16" height="9"  rx="2" fill="rgba(124,58,237,0.25)" />
                      <rect x="15" y="12" width="16" height="9" rx="2" fill="rgba(124,58,237,0.2)" />
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: config.layout === l ? "#e2d9ff" : "#94a3b8" }}>
                    {LAYOUT_META[l].label}
                  </p>
                  <p style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{LAYOUT_META[l].desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Footer */}
          <p style={{ fontSize: 10, color: "#2d3748", textAlign: "center", marginTop: 14 }}>
            Settings saved to your browser
          </p>
        </div>
      )}
    </>
  );
}
