"use client";

/**
 * ThemeProvider.tsx
 *
 * Client-side wrapper that:
 *  1. Provides ThemeContextProvider
 *  2. Reads computed CSS vars and stamps them on a root <div>
 *  3. Renders the background texture overlay
 *  4. Renders the CRT scanlines overlay (arcade theme)
 *  5. Renders the floating <CustomizerPanel>
 *
 * Usage (in a Server Component):
 *   <ThemeProvider fonts="...">{...children}</ThemeProvider>
 */

import type { ReactNode } from "react";
import { ThemeContextProvider, useTheme, type TexturePreset, type ThemeConfig } from "./theme-context";

// ─────────────────────────────────────────────────────────────────────────────
// Texture patterns — pure CSS, no external deps
// ─────────────────────────────────────────────────────────────────────────────

function textureStyle(tex: TexturePreset, isDark: boolean): React.CSSProperties {
  const dot = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)";
  const line = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  switch (tex) {
    case "dots":
      return {
        backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      };
    case "graph":
      return {
        backgroundImage: [
          `linear-gradient(${line} 1px, transparent 1px)`,
          `linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        ].join(", "),
        backgroundSize: "32px 32px",
      };
    case "mesh":
      // Animated radial-gradient mesh applied via keyframe class; we just
      // return minimal inline here and the <style> block handles animation
      return {};
    default:
      return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — reads context, applies styles
// ─────────────────────────────────────────────────────────────────────────────

function ThemeShell({ fontClasses, children }: { fontClasses: string; children: ReactNode }) {
  const { config, vars } = useTheme();

  const isArcade    = config.theme === "arcade";
  const isEditorial = config.theme === "editorial" || config.palette === "alabaster";
  const isDark      = !isEditorial;

  // Texture overlay style
  const texStyle = textureStyle(config.texture, isDark);
  const isMesh   = config.texture === "mesh";

  // Root wrapper style — stamps all CSS variables
  const rootStyle: React.CSSProperties = {
    background: vars["--theme-bg"],
    color:      vars["--theme-text"],
    fontFamily: vars["--theme-font-body"],
    ...(vars as React.CSSProperties),
  };

  return (
    <div
      className={`${fontClasses} min-h-screen relative`}
      style={rootStyle}
      data-theme={config.theme}
    >
      {/* Keyframe styles for mesh + scanlines */}
      <style>{`
        @keyframes meshFloat {
          0%   { background-position: 0% 50%, 100% 0%, 50% 100%; }
          50%  { background-position: 50% 0%, 0% 100%, 100% 50%; }
          100% { background-position: 0% 50%, 100% 0%, 50% 100%; }
        }
        @keyframes scanMove {
          from { transform: translateY(-100%); }
          to   { transform: translateY(100vh); }
        }
        .theme-mesh-overlay {
          background:
            radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.18) 0%, transparent 55%),
            radial-gradient(ellipse at 85% 15%, rgba(236,72,153,0.13) 0%, transparent 55%),
            radial-gradient(ellipse at 60% 85%, rgba(56,189,248,0.12) 0%, transparent 55%);
          background-size: 200% 200%, 200% 200%, 200% 200%;
          animation: meshFloat 12s ease-in-out infinite;
        }
        .theme-crt-scanline {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,255,65,0.03) 2px,
            rgba(0,255,65,0.03) 4px
          );
        }
        .theme-arcade-text {
          text-shadow: var(--theme-crt-glow, none);
        }
      `}</style>

      {/* Background texture overlay (dot / graph / mesh) */}
      {config.texture !== "none" && (
        <div
          className={isMesh ? "theme-mesh-overlay" : ""}
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            ...(!isMesh ? texStyle : {}),
          }}
          aria-hidden="true"
        />
      )}

      {/* CRT scanlines overlay for arcade theme */}
      {isArcade && (
        <div
          className="theme-crt-scanline"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
          }}
          aria-hidden="true"
        />
      )}

      {/* Page content */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — wraps with the Context provider then renders the shell
// ─────────────────────────────────────────────────────────────────────────────

export function ThemeProvider({
  fontClasses,
  initialConfig,
  children,
}: {
  fontClasses:    string;
  /** Creator-saved ThemeConfig from the DB — used as starting state */
  initialConfig?: Partial<ThemeConfig>;
  children:       ReactNode;
}) {
  return (
    <ThemeContextProvider initialConfig={initialConfig}>
      <ThemeShell fontClasses={fontClasses}>
        {children}
      </ThemeShell>
    </ThemeContextProvider>
  );
}
