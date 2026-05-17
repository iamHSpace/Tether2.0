"use client";

/**
 * ThemePreviewPane.tsx
 *
 * Live mini-preview of the public profile rendered using the current
 * ThemeConfig. Accepts config as a prop (no Context needed) so it can be
 * embedded in the Settings page without a ThemeProvider wrapper.
 *
 * Every CSS custom property is stamped on the root div as an inline style;
 * child elements reference them exactly like the real profile does.
 */

import { computeVars, type ThemeConfig, type TexturePreset } from "./theme-context";

// ─── tiny chart helper ────────────────────────────────────────────────────────

function MiniBarChart({ color }: { color: string }) {
  const bars = [40, 65, 55, 80, 70, 90, 75, 85, 60, 95, 80, 70];
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${h}%`,
            borderRadius: 2,
            background: color,
            opacity: 0.75 + (i % 3) * 0.08,
          }}
        />
      ))}
    </div>
  );
}

function MiniAreaLine({ color }: { color: string }) {
  const pts = [30, 45, 38, 60, 52, 70, 65, 80, 72, 90];
  const W = 200; const H = 36;
  const max = Math.max(...pts);
  const coords = pts.map((v, i) => [
    (i / (pts.length - 1)) * W,
    H - (v / max) * (H - 4) - 2,
  ] as [number, number]);

  let line = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 1; i < coords.length; i++) {
    const cp = (coords[i - 1][0] + coords[i][0]) / 2;
    line += ` C ${cp},${coords[i - 1][1]} ${cp},${coords[i][1]} ${coords[i][0]},${coords[i][1]}`;
  }
  const area = `${line} L ${coords[coords.length - 1][0]},${H} L ${coords[0][0]},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="prev-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#prev-grad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── texture background style ─────────────────────────────────────────────────

function textureBg(tex: TexturePreset, isDark: boolean): React.CSSProperties {
  const dot  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const line = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)";

  if (tex === "dots")
    return { backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1px)`, backgroundSize: "20px 20px" };
  if (tex === "graph")
    return {
      backgroundImage: [`linear-gradient(${line} 1px, transparent 1px)`, `linear-gradient(90deg, ${line} 1px, transparent 1px)`].join(", "),
      backgroundSize: "24px 24px",
    };
  if (tex === "mesh")
    return {
      backgroundImage: [
        "radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.18) 0%, transparent 55%)",
        "radial-gradient(ellipse at 80% 20%, rgba(236,72,153,0.13) 0%, transparent 55%)",
        "radial-gradient(ellipse at 60% 85%, rgba(56,189,248,0.12) 0%, transparent 55%)",
      ].join(", "),
    };
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ThemePreviewPane({ config }: { config: ThemeConfig }) {
  const vars    = computeVars(config);
  const bg      = vars["--theme-bg"]             ?? "#070c18";
  const surface = vars["--theme-surface"]        ?? "rgba(255,255,255,0.05)";
  const surfEnd = vars["--theme-surface-end"]    ?? "rgba(255,255,255,0.02)";
  const border  = vars["--theme-border"]         ?? "rgba(255,255,255,0.08)";
  const textHi  = vars["--theme-text"]           ?? "#e2e8f0";
  const textMd  = vars["--theme-text-muted"]     ?? "#94a3b8";
  const textLo  = vars["--theme-text-faint"]     ?? "#475569";
  const accent  = vars["--theme-accent"]         ?? "#7c3aed";
  const acc2    = vars["--theme-accent-alt"]     ?? "#ec4899";
  const radius  = vars["--theme-radius"]         ?? "1rem";
  const blur    = vars["--theme-blur"]           ?? "8px";
  const navBg   = vars["--theme-nav-bg"]         ?? "rgba(7,12,24,0.85)";
  const navBrd  = vars["--theme-nav-border"]     ?? "rgba(255,255,255,0.06)";
  const heroF   = vars["--theme-hero-from"]      ?? "rgba(15,23,42,0.85)";
  const heroT   = vars["--theme-hero-to"]        ?? "rgba(2,6,23,0.8)";
  const bdrW    = vars["--theme-card-border-width"]  ?? "1px";
  const bdrSt   = vars["--theme-card-border-style"]  ?? "solid";
  const shadow  = vars["--theme-card-shadow"]        ?? "none";
  const fontD   = vars["--theme-font-display"]   ?? "Georgia, serif";
  const fontM   = vars["--theme-font-mono"]      ?? "monospace";

  const isArcade = config.theme === "arcade";
  const isDark   = config.theme !== "editorial" && config.palette !== "alabaster";
  const isBrut   = config.theme === "brutalist";

  const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    borderRadius: radius,
    border: `${bdrW} ${bdrSt} ${border}`,
    background: `linear-gradient(135deg, ${surface} 0%, ${surfEnd} 100%)`,
    backdropFilter: blur !== "0px" ? `blur(${blur})` : undefined,
    boxShadow: shadow !== "none" ? shadow : undefined,
    padding: "10px 12px",
    position: "relative",
    overflow: "hidden",
    ...extra,
  });

  const statCard = (label: string, value: string, tint?: string) => (
    <div style={cardStyle()}>
      {tint && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `linear-gradient(135deg, ${tint} 0%, transparent 60%)`,
        }} />
      )}
      <p style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: textLo, marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 700, color: textHi, fontFamily: fontM, lineHeight: 1 }}>
        {value}
      </p>
    </div>
  );

  const isSplit = config.layout === "split";

  const heroCard = (
    <div style={cardStyle({ background: `linear-gradient(135deg, ${heroF} 0%, ${heroT} 100%)`, marginBottom: 8 })}>
      {config.theme === "glassmorphic" && (
        <div style={{ position: "absolute", top: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: `${accent}18`, filter: "blur(20px)", pointerEvents: "none" }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: radius === "0px" ? "4px" : "8px",
          background: `linear-gradient(135deg, ${accent}, ${acc2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 14, flexShrink: 0,
          boxShadow: isArcade ? `0 0 12px ${accent}60` : undefined,
          fontFamily: fontD,
        }}>
          A
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: textHi, fontFamily: fontD, textShadow: isArcade ? `0 0 8px ${accent}` : undefined }}>
              Alex Rivera
            </p>
            <span style={{ fontSize: 7, fontWeight: 700, padding: "1px 5px", borderRadius: "999px", background: "#10b98118", border: "1px solid #10b98130", color: "#10b981" }}>
              ✓ Verified
            </span>
          </div>
          <p style={{ fontSize: 9, color: textMd, fontFamily: fontM, marginBottom: 5 }}>@alexrivera</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {[
              { label: "Tech & Lifestyle", color: accent },
              { label: "YouTube",          color: "#ef4444" },
              { label: "Instagram",        color: acc2 },
            ].map(tag => (
              <span
                key={tag.label}
                style={{
                  fontSize: 8, padding: "1px 6px",
                  borderRadius: radius === "0px" ? "2px" : "999px",
                  border: isBrut ? `1px solid ${tag.color}` : `1px solid ${tag.color}40`,
                  background: `${tag.color}14`,
                  color: tag.color,
                }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
        <div
          style={{
            fontSize: 8, fontWeight: 700, padding: "4px 8px", color: "#fff", whiteSpace: "nowrap",
            borderRadius: radius === "0px" ? "2px" : "6px",
            background: `linear-gradient(135deg, ${accent}, ${acc2})`,
            boxShadow: isBrut ? "2px 2px 0 #000" : undefined,
          }}
        >
          Work With Me
        </div>
      </div>
    </div>
  );

  const statsBlock = (
    <>
      {/* Stat cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
        {statCard("Subscribers", "847.2K", `${accent}14`)}
        {statCard("Total Views",  "124.8M")}
        {statCard("Videos",       "342")}
        {statCard("Avg Views",    "365K")}
      </div>

      {/* Chart card */}
      <div style={cardStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div>
            <p style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: textLo }}>
              Views by Video
            </p>
            <p style={{ fontSize: 8, color: textMd }}>Oldest → newest · 342 videos</p>
          </div>
          <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: "999px", background: `${accent}18`, border: `1px solid ${accent}35`, color: accent, fontWeight: 600 }}>
            Area chart
          </span>
        </div>
        <MiniAreaLine color={accent} />
      </div>

      {/* 30-day bar chart */}
      <div style={{ ...cardStyle(), marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <p style={{ fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: textLo }}>
            30-Day Reach
          </p>
          <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: "999px", background: `${acc2}18`, border: `1px solid ${acc2}35`, color: acc2, fontWeight: 600 }}>
            Daily bar chart
          </span>
        </div>
        <MiniBarChart color={acc2} />
      </div>
    </>
  );

  return (
    <div
      style={{
        background: bg,
        color: textHi,
        borderRadius: 12,
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(0,0,0,0.12)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
        ...(vars as React.CSSProperties),
      }}
    >
      {/* Arcade scanlines */}
      {isArcade && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,255,65,0.03) 4px)",
        }} />
      )}

      {/* Texture */}
      {config.texture !== "none" && config.texture !== "mesh" && (
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, ...textureBg(config.texture, isDark) }} />
      )}
      {config.texture === "mesh" && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
          backgroundImage: [
            "radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.2) 0%, transparent 55%)",
            "radial-gradient(ellipse at 80% 20%, rgba(236,72,153,0.15) 0%, transparent 55%)",
            "radial-gradient(ellipse at 60% 85%, rgba(56,189,248,0.15) 0%, transparent 55%)",
          ].join(", "),
        }} />
      )}

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2 }}>

        {/* Nav */}
        <div style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${navBrd}`,
          background: navBg,
          backdropFilter: isBrut ? undefined : "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 16, height: 16, borderRadius: radius === "0px" ? "3px" : "5px",
              background: `linear-gradient(135deg, ${accent}, ${acc2})`,
            }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: textHi }}>Statvora</span>
          </div>
          <div
            style={{
              fontSize: 8, fontWeight: 700, color: "#fff",
              padding: "2px 8px", borderRadius: radius === "0px" ? "2px" : "5px",
              background: `linear-gradient(135deg, ${accent}, ${acc2})`,
              boxShadow: isBrut ? "1px 1px 0 #000" : undefined,
            }}
          >
            Work With Me
          </div>
        </div>

        {/* Main content */}
        <div
          style={{
            padding: "10px 12px",
            display: isSplit ? "grid" : "block",
            gridTemplateColumns: isSplit ? "2fr 3fr" : undefined,
            gap: isSplit ? 10 : undefined,
          }}
        >
          {isSplit ? (
            <>
              {/* Split: sticky left */}
              <div>{heroCard}</div>
              {/* Split: scrollable right */}
              <div>{statsBlock}</div>
            </>
          ) : (
            <>
              {heroCard}
              {statsBlock}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", padding: "8px 12px", borderTop: `1px solid ${border}`, fontSize: 8, color: textLo }}>
          Powered by{" "}
          <span style={{ color: accent, fontWeight: 600 }}>Statvora</span>
          {" "}— verified creator analytics
        </div>
      </div>
    </div>
  );
}
