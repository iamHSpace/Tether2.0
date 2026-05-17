"use client";

/**
 * theme-context.tsx
 *
 * State management + preset data for the Profile Theme Customisation Engine.
 * Exports: types, preset maps, ThemeContextProvider, useTheme hook.
 */

import {
  createContext, useContext, useState, useCallback,
  useEffect, type ReactNode,
} from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ThemePreset     = "glassmorphic" | "editorial" | "brutalist" | "arcade";
export type TypographyPreset = "minimalist" | "sophisticate" | "retrotech" | "heavyweight";
export type PalettePreset   = "deepspace" | "alabaster" | "monochrome";
export type TexturePreset   = "none" | "dots" | "graph" | "mesh";
export type LayoutPreset    = "asymmetric" | "split";

export interface ThemeConfig {
  theme:      ThemePreset;
  typography: TypographyPreset;
  palette:    PalettePreset;
  texture:    TexturePreset;
  layout:     LayoutPreset;
}

export const DEFAULT_THEME: ThemeConfig = {
  theme:      "glassmorphic",
  typography: "sophisticate",
  palette:    "deepspace",
  texture:    "none",
  layout:     "asymmetric",
};

// ─────────────────────────────────────────────────────────────────────────────
// Preset: CSS variable maps
// ─────────────────────────────────────────────────────────────────────────────

// All values that depend on the chosen global theme
export interface ThemeCSSVars {
  "--theme-bg":                 string;
  "--theme-surface":            string;
  "--theme-surface-end":        string;
  "--theme-border":             string;
  "--theme-text":               string;
  "--theme-text-muted":         string;
  "--theme-text-faint":         string;
  "--theme-accent":             string;
  "--theme-accent-alt":         string;
  "--theme-radius":             string;
  "--theme-blur":               string;
  "--theme-nav-bg":             string;
  "--theme-nav-border":         string;
  "--theme-hero-from":          string;
  "--theme-hero-to":            string;
  "--theme-card-border-width":  string;
  "--theme-card-border-style":  string;
  "--theme-card-shadow":        string;
  "--theme-scanlines":          string; // "1" = show scanlines, "0" = hide
  "--theme-crt-glow":           string; // text-shadow for arcade mode
}

export const THEME_VARS: Record<ThemePreset, ThemeCSSVars> = {
  glassmorphic: {
    "--theme-bg":                "#070c18",
    "--theme-surface":           "rgba(255,255,255,0.05)",
    "--theme-surface-end":       "rgba(255,255,255,0.02)",
    "--theme-border":            "rgba(255,255,255,0.08)",
    "--theme-text":              "#e2e8f0",
    "--theme-text-muted":        "#94a3b8",
    "--theme-text-faint":        "#475569",
    "--theme-accent":            "#7c3aed",
    "--theme-accent-alt":        "#ec4899",
    "--theme-radius":            "1rem",
    "--theme-blur":              "8px",
    "--theme-nav-bg":            "rgba(7,12,24,0.85)",
    "--theme-nav-border":        "rgba(255,255,255,0.06)",
    "--theme-hero-from":         "rgba(15,23,42,0.85)",
    "--theme-hero-to":           "rgba(2,6,23,0.8)",
    "--theme-card-border-width": "1px",
    "--theme-card-border-style": "solid",
    "--theme-card-shadow":       "none",
    "--theme-scanlines":         "0",
    "--theme-crt-glow":          "none",
  },
  editorial: {
    "--theme-bg":                "#FAFAF8",
    "--theme-surface":           "rgba(255,255,255,0.97)",
    "--theme-surface-end":       "rgba(245,244,240,0.97)",
    "--theme-border":            "rgba(0,0,0,0.08)",
    "--theme-text":              "#18181b",
    "--theme-text-muted":        "#52525b",
    "--theme-text-faint":        "#a1a1aa",
    "--theme-accent":            "#1d4ed8",
    "--theme-accent-alt":        "#7c3aed",
    "--theme-radius":            "0.625rem",
    "--theme-blur":              "0px",
    "--theme-nav-bg":            "rgba(250,250,248,0.97)",
    "--theme-nav-border":        "rgba(0,0,0,0.07)",
    "--theme-hero-from":         "rgba(255,255,255,0.99)",
    "--theme-hero-to":           "rgba(244,244,240,0.99)",
    "--theme-card-border-width": "1px",
    "--theme-card-border-style": "solid",
    "--theme-card-shadow":       "0 1px 4px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    "--theme-scanlines":         "0",
    "--theme-crt-glow":          "none",
  },
  brutalist: {
    "--theme-bg":                "#FFFEF0",
    "--theme-surface":           "#FFFFFF",
    "--theme-surface-end":       "#FFFFFF",
    "--theme-border":            "#000000",
    "--theme-text":              "#000000",
    "--theme-text-muted":        "#1a1a1a",
    "--theme-text-faint":        "#555555",
    "--theme-accent":            "#FF3E00",
    "--theme-accent-alt":        "#0000FF",
    "--theme-radius":            "0px",
    "--theme-blur":              "0px",
    "--theme-nav-bg":            "#FFFEF0",
    "--theme-nav-border":        "#000000",
    "--theme-hero-from":         "#FFFFFF",
    "--theme-hero-to":           "#F8F8EE",
    "--theme-card-border-width": "2px",
    "--theme-card-border-style": "solid",
    "--theme-card-shadow":       "4px 4px 0px #000000",
    "--theme-scanlines":         "0",
    "--theme-crt-glow":          "none",
  },
  arcade: {
    "--theme-bg":                "#000000",
    "--theme-surface":           "rgba(0,255,65,0.04)",
    "--theme-surface-end":       "rgba(0,255,65,0.01)",
    "--theme-border":            "rgba(0,255,65,0.3)",
    "--theme-text":              "#00FF41",
    "--theme-text-muted":        "#00CC34",
    "--theme-text-faint":        "#005918",
    "--theme-accent":            "#00FF41",
    "--theme-accent-alt":        "#00D4FF",
    "--theme-radius":            "0.25rem",
    "--theme-blur":              "0px",
    "--theme-nav-bg":            "rgba(0,0,0,0.97)",
    "--theme-nav-border":        "rgba(0,255,65,0.25)",
    "--theme-hero-from":         "rgba(0,20,8,0.97)",
    "--theme-hero-to":           "rgba(0,5,2,0.99)",
    "--theme-card-border-width": "1px",
    "--theme-card-border-style": "solid",
    "--theme-card-shadow":       "0 0 20px rgba(0,255,65,0.06), inset 0 0 30px rgba(0,255,65,0.02)",
    "--theme-scanlines":         "1",
    "--theme-crt-glow":          "0 0 6px currentColor",
  },
};

// Palette overrides — only affect bg/surface colours, layered on top of theme
export const PALETTE_OVERRIDES: Record<PalettePreset, Partial<ThemeCSSVars>> = {
  deepspace:  {}, // palette matches each theme's default dark/terminal style
  alabaster: {
    "--theme-bg":           "#F9FAFB",
    "--theme-surface":      "rgba(255,255,255,0.95)",
    "--theme-surface-end":  "rgba(241,243,245,0.95)",
    "--theme-text":         "#18181b",
    "--theme-text-muted":   "#52525b",
    "--theme-text-faint":   "#a1a1aa",
    "--theme-nav-bg":       "rgba(249,250,251,0.97)",
    "--theme-hero-from":    "rgba(255,255,255,0.99)",
    "--theme-hero-to":      "rgba(244,245,247,0.99)",
  },
  monochrome: {
    "--theme-bg":           "#000000",
    "--theme-surface":      "rgba(255,255,255,0.06)",
    "--theme-surface-end":  "rgba(255,255,255,0.02)",
    "--theme-border":       "rgba(255,255,255,0.15)",
    "--theme-text":         "#FFFFFF",
    "--theme-text-muted":   "#AAAAAA",
    "--theme-text-faint":   "#555555",
    "--theme-accent":       "#FFFFFF",
    "--theme-accent-alt":   "#CCCCCC",
    "--theme-nav-bg":       "rgba(0,0,0,0.92)",
    "--theme-nav-border":   "rgba(255,255,255,0.12)",
    "--theme-hero-from":    "rgba(20,20,20,0.97)",
    "--theme-hero-to":      "rgba(0,0,0,0.99)",
  },
};

// Typography: font-family values per preset
export interface TypographyCSSVars {
  "--theme-font-display": string;
  "--theme-font-body":    string;
  "--theme-font-mono":    string;
}

export const TYPOGRAPHY_VARS: Record<TypographyPreset, TypographyCSSVars> = {
  minimalist: {
    "--theme-font-display": "var(--font-inter), system-ui, sans-serif",
    "--theme-font-body":    "var(--font-inter), system-ui, sans-serif",
    "--theme-font-mono":    "var(--font-jetbrains), monospace",
  },
  sophisticate: {
    "--theme-font-display": "var(--font-playfair), Georgia, serif",
    "--theme-font-body":    "var(--font-lato), system-ui, sans-serif",
    "--theme-font-mono":    "var(--font-space-mono), 'Courier New', monospace",
  },
  retrotech: {
    "--theme-font-display": "var(--font-vt323), 'Courier New', monospace",
    "--theme-font-body":    "var(--font-roboto), system-ui, sans-serif",
    "--theme-font-mono":    "var(--font-inconsolata), 'Courier New', monospace",
  },
  heavyweight: {
    "--theme-font-display": "var(--font-oswald), Impact, sans-serif",
    "--theme-font-body":    "var(--font-open-sans), system-ui, sans-serif",
    "--theme-font-mono":    "var(--font-roboto-mono), monospace",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable labels for the UI
// ─────────────────────────────────────────────────────────────────────────────

export const THEME_META: Record<ThemePreset, { label: string; desc: string; swatch: string }> = {
  glassmorphic: { label: "Glassmorphic",  desc: "Frosted glass · dark · glowing accents", swatch: "from-violet-900 to-slate-900" },
  editorial:    { label: "Editorial",     desc: "Serif · clean light · magazine aesthetic", swatch: "from-stone-100 to-white" },
  brutalist:    { label: "Neo-Brutalist", desc: "Thick borders · box shadows · bold type",  swatch: "from-yellow-50 to-white" },
  arcade:       { label: "2D Arcade",     desc: "CRT terminal · scanlines · phosphor glow", swatch: "from-black to-green-950" },
};

export const TYPOGRAPHY_META: Record<TypographyPreset, { label: string; display: string; body: string; mono: string }> = {
  minimalist:  { label: "Minimalist",  display: "Inter",          body: "Inter",      mono: "JetBrains" },
  sophisticate:{ label: "Sophisticate",display: "Playfair",       body: "Lato",       mono: "Space Mono" },
  retrotech:   { label: "Retro Tech",  display: "VT323",          body: "Roboto",     mono: "Inconsolata" },
  heavyweight: { label: "Heavyweight", display: "Oswald",         body: "Open Sans",  mono: "Roboto Mono" },
};

export const PALETTE_META: Record<PalettePreset, { label: string; swatch: string }> = {
  deepspace:  { label: "Deep Space",  swatch: "#0F172A" },
  alabaster:  { label: "Alabaster",   swatch: "#F9FAFB" },
  monochrome: { label: "Monochrome",  swatch: "#000000" },
};

export const TEXTURE_META: Record<TexturePreset, { label: string; icon: string }> = {
  none:  { label: "None",        icon: "—" },
  dots:  { label: "Dot Grid",    icon: "·" },
  graph: { label: "Graph Paper", icon: "#" },
  mesh:  { label: "Aura Mesh",   icon: "✦" },
};

export const LAYOUT_META: Record<LayoutPreset, { label: string; desc: string }> = {
  asymmetric: { label: "Bento",        desc: "Single column · asymmetric bento grid" },
  split:      { label: "Column Split", desc: "40/60 split · sticky profile left" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Computed vars helper — merges theme + palette + typography into one flat map
// ─────────────────────────────────────────────────────────────────────────────

export function computeVars(cfg: ThemeConfig): Record<string, string> {
  const base    = { ...THEME_VARS[cfg.theme] };
  const palette = { ...PALETTE_OVERRIDES[cfg.palette] };

  // Arcade has a strong terminal identity — palette overrides must NOT clobber
  // its signature green text/border/accent, only the background can shift.
  if (cfg.theme === "arcade" && Object.keys(palette).length > 0) {
    delete palette["--theme-text"];
    delete palette["--theme-text-muted"];
    delete palette["--theme-text-faint"];
    delete palette["--theme-accent"];
    delete palette["--theme-accent-alt"];
    delete palette["--theme-border"];
  }

  // Brutalist + Monochrome: the black offset shadow is invisible on black bg.
  // Flip it to a white shadow so the neo-brutalist effect survives.
  if (cfg.theme === "brutalist" && cfg.palette === "monochrome") {
    palette["--theme-card-shadow"] = "4px 4px 0 rgba(255,255,255,0.5)";
    palette["--theme-nav-border"]  = "rgba(255,255,255,0.3)";
  }

  return {
    ...base,
    ...palette,
    ...TYPOGRAPHY_VARS[cfg.typography],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  config:        ThemeConfig;
  vars:          Record<string, string>;
  setTheme:      (t: ThemePreset)      => void;
  setTypography: (t: TypographyPreset) => void;
  setPalette:    (p: PalettePreset)    => void;
  setTexture:    (t: TexturePreset)    => void;
  setLayout:     (l: LayoutPreset)     => void;
  resetTheme:    () => void;
}

const ThemeCtx = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeContextProvider");
  return ctx;
}

const STORAGE_KEY = "sv_profile_theme_v1";

export function ThemeContextProvider({
  children,
  initialConfig,
}: {
  children:       ReactNode;
  /** Creator-saved theme loaded from the DB. Used as the starting state
   *  so visitors always see the creator's chosen style first. */
  initialConfig?: Partial<ThemeConfig>;
}) {
  const base = initialConfig
    ? { ...DEFAULT_THEME, ...initialConfig }
    : DEFAULT_THEME;

  const [config, setConfig] = useState<ThemeConfig>(base);

  // Persist whenever config changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* ignore */ }
  }, [config]);

  const setTheme      = useCallback((t: ThemePreset)      => setConfig(c => ({ ...c, theme:      t })), []);
  const setTypography = useCallback((t: TypographyPreset) => setConfig(c => ({ ...c, typography: t })), []);
  const setPalette    = useCallback((p: PalettePreset)    => setConfig(c => ({ ...c, palette:    p })), []);
  const setTexture    = useCallback((t: TexturePreset)    => setConfig(c => ({ ...c, texture:    t })), []);
  const setLayout     = useCallback((l: LayoutPreset)     => setConfig(c => ({ ...c, layout:     l })), []);
  const resetTheme    = useCallback(() => setConfig(DEFAULT_THEME), []);

  const vars = computeVars(config);

  return (
    <ThemeCtx.Provider value={{ config, vars, setTheme, setTypography, setPalette, setTexture, setLayout, resetTheme }}>
      {children}
    </ThemeCtx.Provider>
  );
}
