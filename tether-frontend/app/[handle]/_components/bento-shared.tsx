/**
 * bento-shared.tsx
 *
 * Shared primitives for the dark bento portfolio page:
 *   - VisibilityConfig type
 *   - MONO / fmtK / fmtPrecise formatters
 *   - SVG charts (DarkAreaChart, DailyBarChart, HorizontalBarChart, DonutChart)
 *   - Card & stat components (BentoCard, StatLabel, StatValue, StatSub, VerifiedPill)
 *
 * Imported by YouTubeBentoGrid, InstagramBentoGrid, and page.tsx.
 */

import { IconShield } from "@/components/ui/Icons";

// ─────────────────────────────────────────────────────────────────────────────
// Visibility config — one boolean flag per metric
// ─────────────────────────────────────────────────────────────────────────────

export interface VisibilityConfig {
  // YouTube
  yt_subscribers:         boolean;
  yt_total_views:         boolean;
  yt_video_count:         boolean;
  yt_avg_views:           boolean;
  yt_content_span:        boolean;
  yt_sub_view_ratio:      boolean;
  yt_ghost_views:         boolean;
  yt_upload_velocity:     boolean;
  yt_avg_engagement:      boolean;
  yt_views_by_video:      boolean;
  yt_recency_decay:       boolean;
  yt_video_feed:          boolean;
  // Instagram
  ig_followers:           boolean;
  ig_posts:               boolean;
  ig_reach_30d_chart:     boolean;
  ig_reach_30d_total:     boolean;
  ig_profile_views_7d:    boolean;
  ig_website_clicks_7d:   boolean;
  ig_audience_country:    boolean;
  ig_audience_age_gender: boolean;
  ig_post_feed:           boolean;
  ig_stories:             boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Typography / CSS helpers
// ─────────────────────────────────────────────────────────────────────────────

/** JetBrains Mono — applied via CSS variable injected by page.tsx */
export const MONO: React.CSSProperties = { fontFamily: "var(--font-jetbrains)" };

// ─────────────────────────────────────────────────────────────────────────────
// Number formatters
// ─────────────────────────────────────────────────────────────────────────────

export function fmtK(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtPrecise(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG chart components — zero external dependencies
// ─────────────────────────────────────────────────────────────────────────────

/** Smooth cubic-bezier area chart, dark-mode ready */
export function DarkAreaChart({
  data, color, gradientId,
}: {
  data: number[];
  color: string;
  gradientId: string;
}) {
  if (data.length < 2) return <div className="h-16 rounded-lg bg-white/[0.03]" />;

  const W = 500; const H = 72;
  const mx = Math.max(...data);
  const mn = Math.min(...data);
  const rng = mx - mn || 1;
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - 6 - ((v - mn) / rng) * (H - 12),
  ]);

  let line = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cp = (pts[i - 1][0] + pts[i][0]) / 2;
    line += ` C ${cp},${pts[i - 1][1]} ${cp},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
  }
  const area = `${line} L ${pts[pts.length - 1][0]},${H} L ${pts[0][0]},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Vertical daily bar chart — ideal for 30-day reach */
export function DailyBarChart({
  data,
  color = "#ec4899",
}: {
  data: number[];
  color?: string;
}) {
  if (!data.length) return <div className="h-16 rounded-lg bg-white/[0.03]" />;

  const H = 60;
  const gap = 2;
  const max = Math.max(...data) || 1;
  const bW = Math.max(4, (500 - gap * (data.length - 1)) / data.length);
  const gradId = `dbar-${color.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${data.length * (bW + gap)} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * H);
        return (
          <rect
            key={i}
            x={i * (bW + gap)}
            y={H - h}
            width={bW}
            height={h}
            rx="1.5"
            fill={`url(#${gradId})`}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/** Horizontal percentage bar chart — country / category breakdowns */
export function HorizontalBarChart({
  items,
  color = "#7c3aed",
}: {
  items: { label: string; value: number; pct: number }[];
  color?: string;
}) {
  if (!items.length) return null;
  return (
    <div className="space-y-2.5">
      {items.map(item => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[11px] font-semibold w-7 text-slate-400 shrink-0" style={MONO}>
            {item.label}
          </span>
          <div className="flex-1 bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(item.pct, 100)}%`,
                background: `linear-gradient(90deg, ${color}cc, ${color}55)`,
              }}
            />
          </div>
          <span className="text-[11px] text-slate-400 w-8 text-right shrink-0" style={MONO}>
            {item.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** SVG donut chart — age/gender or any percentage split */
export function DonutChart({
  slices,
  cx = 60,
  cy = 60,
  r = 44,
  ir = 28,
}: {
  slices: { value: number; color: string; label: string }[];
  cx?: number;
  cy?: number;
  r?: number;
  ir?: number;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -Math.PI / 2; // start at 12 o'clock

  const paths = slices.map(sl => {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r  * Math.cos(angle);
    const y1 = cy + r  * Math.sin(angle);
    const x2 = cx + r  * Math.cos(angle + sweep);
    const y2 = cy + r  * Math.sin(angle + sweep);
    const ix1 = cx + ir * Math.cos(angle + sweep);
    const iy1 = cy + ir * Math.sin(angle + sweep);
    const ix2 = cx + ir * Math.cos(angle);
    const iy2 = cy + ir * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
    angle += sweep;
    return { d, color: sl.color };
  });

  return (
    <svg viewBox={`0 0 ${cx * 2} ${cy * 2}`} width={cx * 2} height={cy * 2}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity="0.85" />
      ))}
      {/* Hollow centre matches page background */}
      <circle cx={cx} cy={cy} r={ir - 1} fill="#0a0f1e" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card & stat primitives
// ─────────────────────────────────────────────────────────────────────────────

/** Glass card — base primitive for every bento cell */
export function BentoCard({
  children,
  span,
  className = "",
  glow,
}: {
  children: React.ReactNode;
  span?: string;
  className?: string;
  glow?: "purple" | "pink" | "red" | "teal";
}) {
  const glowMap = {
    purple: "shadow-[0_0_40px_-12px_rgba(124,58,237,0.35)]",
    pink:   "shadow-[0_0_40px_-12px_rgba(236,72,153,0.35)]",
    red:    "shadow-[0_0_40px_-12px_rgba(239,68,68,0.3)]",
    teal:   "shadow-[0_0_40px_-12px_rgba(20,184,166,0.3)]",
  };
  return (
    <div
      className={[
        "rounded-2xl border border-white/[0.08]",
        "bg-gradient-to-br from-white/[0.05] to-white/[0.02]",
        "backdrop-blur-sm p-5 flex flex-col",
        glow ? glowMap[glow] : "",
        span ?? "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Tiny all-caps label above a stat */
export function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">
      {children}
    </p>
  );
}

/** Large monospace number */
export function StatValue({
  children,
  size = "lg",
}: {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
}) {
  const sizes = {
    sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-3xl", "2xl": "text-4xl",
  };
  return (
    <p className={`${sizes[size]} font-bold text-slate-100 leading-none`} style={MONO}>
      {children}
    </p>
  );
}

/** Muted sub-line below a stat value */
export function StatSub({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 mt-1">{children}</p>;
}

/** Green "Verified" pill badge */
export function VerifiedPill() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <IconShield size={8} /> Verified
    </span>
  );
}
