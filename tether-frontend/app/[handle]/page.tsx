import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { fmt, timeAgo } from "@/lib/utils";
import {
  Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY,
  SnapshotData, InstagramSnapshotData, InstagramAccountInsights,
} from "@/lib/api";
import {
  IconYoutube, IconInstagram, IconExternal, IconShield,
  IconUsers, IconEye, IconVideo, IconTrendUp,
} from "@/components/ui/Icons";
import { ShareButton } from "./_components/ShareButton";
import { TrackView } from "./_components/TrackView";

// ─────────────────────────────────────────────────────────────────────────────
// Fonts
// ─────────────────────────────────────────────────────────────────────────────

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-playfair",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

// ─────────────────────────────────────────────────────────────────────────────
// ISR / server config
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 300;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://statvora.in";

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — every single metric carries `isVisible: boolean`
// In production these values come from the API; `isVisible` is derived from
// profile.metric_visibility (YouTube) and the creator's chosen privacy settings.
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

const DEFAULT_VIS: VisibilityConfig = {
  yt_subscribers: true,  yt_total_views: true,  yt_video_count: true,
  yt_avg_views: true,    yt_content_span: true, yt_sub_view_ratio: true,
  yt_ghost_views: true,  yt_upload_velocity: true, yt_avg_engagement: true,
  yt_views_by_video: true, yt_recency_decay: true, yt_video_feed: true,
  ig_followers: true,    ig_posts: true,
  ig_reach_30d_chart: true, ig_reach_30d_total: true,
  ig_profile_views_7d: true, ig_website_clicks_7d: true,
  ig_audience_country: true, ig_audience_age_gender: true,
  ig_post_feed: true,    ig_stories: true,
};

/** Full mock object — shape mirrors what the real API returns */
const MOCK_CREATOR = {
  profile: {
    full_name: "Alex Rivera", username: "alexrivera",
    bio: "Tech reviews & lifestyle vlogs. Helping 800K+ humans cut through the noise.",
    category: "Tech & Lifestyle", creator_stage: "established", website: "https://alexrivera.co",
  },
  visibility: DEFAULT_VIS,
  youtube: {
    subscribers:          { value: 847_200,      isVisible: true },
    totalViews:           { value: 124_800_000,  isVisible: true },
    videoCount:           { value: 342,          isVisible: true },
    avgViews:             { value: 365_000,      isVisible: true },
    contentSpanDays:      { value: 2_847,        isVisible: true },
    subToViewRatio:       { value: 147.3,        isVisible: true },
    ghostViews:           { value: 3_200_000,    isVisible: true },
    uploadVelocityDays:   { value: 8.3,          isVisible: true },
    avgEngagementPct:     { value: 4.2,          isVisible: true },
    viewsChartData:       { value: [280000,310000,295000,340000,365000,320000,410000,390000,450000,380000], isVisible: true },
    recencyDecayData:     { value: [450000,390000,320000,280000,195000,140000], isVisible: true },
    videoFeed: {
      isVisible: true,
      value: [
        { id: "1", title: "I tested every budget phone in 2025", views: 1_240_000, likes: 38_200, comments: 1_840, publishedAt: "2025-04-12" },
        { id: "2", title: "The laptop I use to run my whole business", views: 890_000,   likes: 27_100, comments: 920,   publishedAt: "2025-03-28" },
        { id: "3", title: "Why I almost quit YouTube (honest)",       views: 2_100_000,  likes: 91_400, comments: 4_210, publishedAt: "2025-03-10" },
        { id: "4", title: "48h productivity challenge — full results",views: 650_000,    likes: 18_800, comments: 760,   publishedAt: "2025-02-22" },
        { id: "5", title: "Honest AI tools tier list 2025",           views: 1_050_000,  likes: 34_600, comments: 2_100, publishedAt: "2025-02-05" },
      ],
    },
  },
  instagram: {
    followers:           { value: 124_700,     isVisible: true },
    posts:               { value: 892,         isVisible: true },
    reach30dData:        { value: [18200,19400,17800,21000,24500,23100,20800,19600,22300,25100,24000,21700,20400,19800,23500,26000,25400,22100,21000,23800,27300,26100,24800,23200,22600,24100,26800,25300,23900,22400], isVisible: true },
    reach30dTotal:       { value: 1_241_600,   isVisible: true },
    profileViews7d:      { value: 8_420,       isVisible: true },
    websiteClicks7d:     { value: 1_230,       isVisible: true },
    audienceCountry:     { value: { IN: 45, US: 22, GB: 8, CA: 6, AU: 4 }, isVisible: true },
    audienceAgeGender:   { value: { "M.18-24": 15, "M.25-34": 22, "M.35-44": 8, "F.18-24": 18, "F.25-34": 28, "F.35-44": 9 }, isVisible: true },
    postFeed: {
      isVisible: true,
      value: [
        { id: "p1", caption: "New gear arrived — full review dropping Friday", media_type: "IMAGE", like_count: 4_820, comments_count: 312, reach: 31_400, saved: 890, shares: 210, follows: 48, profile_visits: 1_240, total_interactions: 6_280 },
        { id: "p2", caption: "The AI setup that changed my workflow",            media_type: "VIDEO", like_count: 7_100, comments_count: 541, reach: 52_000, saved: 1_540, shares: 420, follows: 92, profile_visits: 2_180, total_interactions: 9_693 },
        { id: "p3", caption: "Behind the scenes: studio tour 2025",              media_type: "CAROUSEL_ALBUM", like_count: 3_210, comments_count: 198, reach: 24_800, saved: 670, shares: 145, follows: 31, profile_visits: 840, total_interactions: 4_254 },
      ],
    },
    stories: {
      isVisible: true,
      value: { reach: 14_200, impressions: 18_600, exits: 820, replies: 94, taps_forward: 3_100, taps_back: 410 },
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────────────────────

interface CreatorData {
  profile: Profile;
  platforms: PlatformInfo[];
  snapshots: Record<string, { data: SnapshotData; captured_at: string }>;
}

async function getProfile(username: string): Promise<CreatorData | null> {
  const res = await fetch(`${BACKEND}/api/creators/${encodeURIComponent(username)}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

function resolveHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  return decoded.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> }
): Promise<Metadata> {
  const { handle } = await params;
  const username = resolveHandle(handle);
  if (!username) return { title: "Not found" };

  const data = await getProfile(username).catch(() => null);
  if (!data) return { title: "Creator not found" };

  const { profile, snapshots } = data;
  const name = profile.full_name ?? `@${profile.username}`;
  const ytChannel = snapshots["youtube"]?.data?.channel;
  const subCount  = ytChannel?.subscribers;
  const category  = profile.category ? `${profile.category} creator` : "creator";
  const ogTitle   = `${name} — Verified ${category} profile on Statvora`;

  const descParts: string[] = [];
  if (subCount) descParts.push(`${fmt(subCount)} YouTube subscribers`);
  if (profile.bio) descParts.push(profile.bio);
  descParts.push("All metrics verified directly from YouTube's API — no self-reported numbers.");
  const richDescription = descParts.join(". ").slice(0, 160);
  const pageUrl = `${APP_URL}/@${username}`;

  return {
    title: ogTitle,
    description: richDescription,
    alternates: { canonical: pageUrl },
    openGraph: { type: "profile", siteName: "Statvora", title: ogTitle, description: richDescription, url: pageUrl },
    twitter: { card: "summary_large_image", title: ogTitle, description: richDescription },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MONO: React.CSSProperties = { fontFamily: "var(--font-jetbrains)" };
const DISPLAY: React.CSSProperties = { fontFamily: "var(--font-playfair)" };

function fmtK(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtPrecise(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const stageLabels: Record<string, string> = {
  just_starting: "Just Starting", growing: "Growing Fast",
  established: "Established", pro: "Pro Creator",
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart components — dark mode SVG, zero external deps
// ─────────────────────────────────────────────────────────────────────────────

/** Smooth area chart */
function DarkAreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return <div className="h-16 rounded-lg bg-white/[0.03]" />;
  const W = 500; const H = 72;
  const mx = Math.max(...data); const mn = Math.min(...data); const rng = mx - mn || 1;
  const pts: [number, number][] = data.map((v, i) => [(i / (data.length - 1)) * W, H - 6 - ((v - mn) / rng) * (H - 12)]);
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
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Daily bar chart — 30 thin bars */
function DailyBarChart({ data, color = "#ec4899" }: { data: number[]; color?: string }) {
  if (!data.length) return <div className="h-16 rounded-lg bg-white/[0.03]" />;
  const H = 60; const gap = 2;
  const max = Math.max(...data) || 1;
  const bW = Math.max(4, (500 - gap * (data.length - 1)) / data.length);
  return (
    <svg viewBox={`0 0 ${data.length * (bW + gap)} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`dbar-${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
      </defs>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * H);
        return <rect key={i} x={i * (bW + gap)} y={H - h} width={bW} height={h} rx="1.5" fill={`url(#dbar-${color.slice(1)})`} opacity={0.85} />;
      })}
    </svg>
  );
}

/** Horizontal bar chart — country or category breakdown */
function HorizontalBarChart({ items, color = "#7c3aed" }: { items: { label: string; value: number; pct: number }[]; color?: string }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-[11px] font-semibold w-7 text-slate-400 shrink-0" style={MONO}>{item.label}</span>
          <div className="flex-1 bg-white/[0.06] rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(item.pct, 100)}%`, background: `linear-gradient(90deg, ${color}cc, ${color}55)` }}
            />
          </div>
          <span className="text-[11px] text-slate-400 w-8 text-right shrink-0" style={MONO}>{item.pct}%</span>
        </div>
      ))}
    </div>
  );
}

/** Donut chart — age/gender split */
function DonutChart({ slices, cx = 60, cy = 60, r = 44, ir = 28 }: {
  slices: { value: number; color: string; label: string }[];
  cx?: number; cy?: number; r?: number; ir?: number;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -Math.PI / 2; // start from top
  const paths: { d: string; color: string; label: string }[] = [];

  for (const sl of slices) {
    const sweep = (sl.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const ix1 = cx + ir * Math.cos(angle + sweep);
    const iy1 = cy + ir * Math.sin(angle + sweep);
    const ix2 = cx + ir * Math.cos(angle);
    const iy2 = cy + ir * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${ir} ${ir} 0 ${large} 0 ${ix2} ${iy2} Z`;
    paths.push({ d, color: sl.color, label: sl.label });
    angle += sweep;
  }

  return (
    <svg viewBox={`0 0 ${cx * 2} ${cy * 2}`} width={cx * 2} height={cy * 2}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} opacity="0.85" />
      ))}
      <circle cx={cx} cy={cy} r={ir - 1} fill="#0a0f1e" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BentoCard — glass card primitive
// ─────────────────────────────────────────────────────────────────────────────

type ColSpan = "col-span-1" | "col-span-2" | "col-span-3" | "col-span-4" |
               "lg:col-span-1" | "lg:col-span-2" | "lg:col-span-3" | "lg:col-span-4" |
               "md:col-span-1" | "md:col-span-2";

function BentoCard({
  children, span, className = "", glow,
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
    <div className={[
      "rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-white/[0.02]",
      "backdrop-blur-sm p-5 flex flex-col",
      glow ? glowMap[glow] : "",
      span ?? "",
      className,
    ].join(" ")}>
      {children}
    </div>
  );
}

/** Small muted label above a stat */
function StatLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">{children}</p>;
}

/** Large monospace number display */
function StatValue({ children, size = "lg" }: { children: React.ReactNode; size?: "sm" | "md" | "lg" | "xl" | "2xl" }) {
  const sizes = { sm: "text-base", md: "text-xl", lg: "text-2xl", xl: "text-3xl", "2xl": "text-4xl" };
  return (
    <p className={`${sizes[size]} font-bold text-slate-100 leading-none`} style={MONO}>
      {children}
    </p>
  );
}

/** Dimmer sub-line below stat */
function StatSub({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-slate-500 mt-1">{children}</p>;
}

/** Verified pill badge */
function VerifiedPill() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      <IconShield size={8} /> Verified
    </span>
  );
}

/** Section divider with platform label */
function PlatformDivider({ platform, icon: Icon, color }: { platform: string; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-bold ${color}`}>
        <Icon size={13} /> {platform}
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/[0.08] to-transparent" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics helpers (derived metrics from raw snapshot data)
// ─────────────────────────────────────────────────────────────────────────────

function computeYtAnalytics(ytData: SnapshotData) {
  const { videos, channel: ch } = ytData;
  if (!videos?.length) return null;
  const sorted = [...videos].sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt));
  const accountAgeDays = sorted.length > 1
    ? Math.round((+new Date(sorted.at(-1)!.publishedAt) - +new Date(sorted[0].publishedAt)) / 86_400_000)
    : 0;
  const uploadVelocity = sorted.length > 1 ? accountAgeDays / (sorted.length - 1) : 0;
  const knownViews = videos.reduce((s, v) => s + v.views, 0);
  const ghostViews = Math.max(0, ch.totalViews - knownViews);
  const subToViewRatio = ch.subscribers > 0 ? ch.totalViews / ch.subscribers : 0;
  const avgEngagement = videos.length > 0
    ? videos.reduce((s, v) => s + (v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0), 0) / videos.length
    : 0;
  const viewsChartData = sorted.map(v => v.views);
  const recencyDecayData = [...sorted].reverse().slice(0, 6).map(v => v.views);
  return { accountAgeDays, uploadVelocity, ghostViews, subToViewRatio, avgEngagement, viewsChartData, recencyDecayData };
}

function igToVis(mv: MetricVisibility): VisibilityConfig {
  return {
    yt_subscribers: mv.subscribers, yt_total_views: mv.total_views, yt_video_count: mv.video_count,
    yt_avg_views: mv.avg_views, yt_content_span: mv.avg_views, yt_sub_view_ratio: mv.avg_views,
    yt_ghost_views: mv.total_views, yt_upload_velocity: mv.avg_views, yt_avg_engagement: mv.avg_views,
    yt_views_by_video: mv.view_chart, yt_recency_decay: mv.view_chart, yt_video_feed: mv.recent_videos,
    ig_followers: true, ig_posts: true,
    ig_reach_30d_chart: true, ig_reach_30d_total: true,
    ig_profile_views_7d: true, ig_website_clicks_7d: true,
    ig_audience_country: true, ig_audience_age_gender: true,
    ig_post_feed: true, ig_stories: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── HERO SECTION ──────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({
  profile, platforms, capturedAt, username,
}: {
  profile: Profile;
  platforms: PlatformInfo[];
  capturedAt: string | null;
  username: string;
}) {
  const initials = (profile.full_name?.[0] ?? profile.username?.[0] ?? "?").toUpperCase();
  const ytConnected = platforms.some(p => p.platform === "youtube");
  const igConnected = platforms.some(p => p.platform === "instagram");

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-slate-950/80">
      {/* Ambient glow backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-pink-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 p-7 md:p-9">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0 text-3xl font-bold text-white shadow-xl"
            style={DISPLAY}>
            {initials}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-50 tracking-tight" style={DISPLAY}>
                {profile.full_name ?? `@${profile.username}`}
              </h1>
              <VerifiedPill />
            </div>
            <p className="text-sm text-slate-400 mb-3" style={MONO}>@{profile.username}</p>

            {profile.bio && (
              <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-xl mb-4">
                {profile.bio}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {profile.category && (
                <span className="text-xs px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                  {profile.category}
                </span>
              )}
              {profile.creator_stage && (
                <span className="text-xs px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.1] text-slate-400 font-medium">
                  {stageLabels[profile.creator_stage] ?? profile.creator_stage}
                </span>
              )}
              {ytConnected && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                  <IconYoutube size={11} /> YouTube
                </span>
              )}
              {igConnected && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 font-medium">
                  <IconInstagram size={11} /> Instagram
                </span>
              )}
              {capturedAt && (
                <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 font-medium">
                  Updated {timeAgo(capturedAt)}
                </span>
              )}
            </div>
          </div>

          {/* CTA — sticky on mobile via fixed-bottom, inline on desktop */}
          <div className="flex flex-row md:flex-col gap-2 shrink-0">
            <a
              href={`/login?intent=contact&creator=${username}`}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 transition-all shadow-lg shadow-violet-900/40 whitespace-nowrap"
            >
              Work With Me
            </a>
            {profile.website && (
              <a
                href={profile.website}
                target="_blank" rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-white/[0.1] text-slate-400 hover:text-slate-200 hover:border-white/[0.2] transition-all whitespace-nowrap flex items-center gap-1.5"
              >
                <IconExternal size={12} /> Website
              </a>
            )}
          </div>
        </div>

        {/* Verified notice */}
        <div className="mt-5 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/[0.15]">
          <IconShield size={13} className="text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-400">
            All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported or estimated.
          </p>
          <ShareButton />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── YOUTUBE BENTO GRID ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function YouTubeBentoGrid({
  ytPlatform, ytData, vis,
}: {
  ytPlatform: PlatformInfo;
  ytData: SnapshotData;
  vis: VisibilityConfig;
}) {
  const ch = ytData.channel;
  const analytics = computeYtAnalytics(ytData);
  const avgViewsPerVideo = ch.videoCount > 0 ? Math.round(ch.totalViews / ch.videoCount) : 0;

  return (
    <div className="space-y-5">
      {/* Platform label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
            <IconYoutube size={17} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">{ytPlatform.platform_username}</p>
            {ch.handle && <p className="text-xs text-slate-500" style={MONO}>{ch.handle}</p>}
          </div>
        </div>
        <a href={`https://youtube.com/channel/${ytPlatform.platform_user_id}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <IconExternal size={11} /> View channel
        </a>
      </div>

      {/* ── Row 1: Hero stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Subscribers — hero card spanning 2 cols */}
        {vis.yt_subscribers && (
          <BentoCard span="col-span-2" glow="red" className="bg-gradient-to-br from-red-500/10 via-transparent to-transparent border-red-500/15">
            <div className="flex items-start justify-between mb-3">
              <StatLabel>Subscribers</StatLabel>
              <IconUsers size={14} className="text-red-400" />
            </div>
            <StatValue size="2xl">{fmtK(ch.subscribers)}</StatValue>
            <StatSub>Total subscriber count</StatSub>
          </BentoCard>
        )}

        {vis.yt_total_views && (
          <BentoCard>
            <StatLabel>Total Views</StatLabel>
            <StatValue size="xl">{fmtK(ch.totalViews)}</StatValue>
            <StatSub>Lifetime view count</StatSub>
          </BentoCard>
        )}

        {vis.yt_video_count && (
          <BentoCard>
            <StatLabel>Videos</StatLabel>
            <StatValue size="xl">{ch.videoCount.toLocaleString()}</StatValue>
            <StatSub>Uploaded to date</StatSub>
          </BentoCard>
        )}
      </div>

      {/* ── Row 2: Derived metrics ── */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {vis.yt_avg_views && (
            <BentoCard>
              <StatLabel>Avg Views / Video</StatLabel>
              <StatValue size="lg">{fmtK(avgViewsPerVideo)}</StatValue>
              <StatSub>across {ch.videoCount} videos</StatSub>
            </BentoCard>
          )}
          {vis.yt_content_span && (
            <BentoCard>
              <StatLabel>Content Span</StatLabel>
              <StatValue size="lg">{analytics.accountAgeDays.toLocaleString()}<span className="text-base text-slate-500 ml-1">d</span></StatValue>
              <StatSub>days since first upload</StatSub>
            </BentoCard>
          )}
          {vis.yt_sub_view_ratio && (
            <BentoCard>
              <StatLabel>Sub-to-View Ratio</StatLabel>
              <StatValue size="lg">{(Math.round(analytics.subToViewRatio * 10) / 10).toFixed(1)}<span className="text-base text-slate-500 ml-1">×</span></StatValue>
              <StatSub>views per subscriber</StatSub>
            </BentoCard>
          )}
          {vis.yt_ghost_views && (
            <BentoCard>
              <StatLabel>Ghost Views</StatLabel>
              <StatValue size="lg">{fmtK(analytics.ghostViews)}</StatValue>
              <StatSub>unlisted / older content</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 3: Upload metrics ── */}
      {analytics && (vis.yt_upload_velocity || vis.yt_avg_engagement) && (
        <div className="grid grid-cols-2 gap-3">
          {vis.yt_upload_velocity && (
            <BentoCard>
              <StatLabel>Upload Velocity</StatLabel>
              <StatValue size="lg">{(Math.round(analytics.uploadVelocity * 10) / 10).toFixed(1)}<span className="text-base text-slate-500 ml-1">d</span></StatValue>
              <StatSub>avg days between uploads</StatSub>
            </BentoCard>
          )}
          {vis.yt_avg_engagement && (
            <BentoCard glow="purple">
              <StatLabel>Avg Engagement</StatLabel>
              <StatValue size="lg">{analytics.avgEngagement.toFixed(2)}<span className="text-base text-slate-500 ml-1">%</span></StatValue>
              <StatSub>(likes + comments) / views</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 4: Views by video chart (full width) ── */}
      {vis.yt_views_by_video && analytics && ytData.videos.length >= 3 && (
        <BentoCard span="col-span-full" glow="purple">
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>Views by Video</StatLabel>
              <p className="text-xs text-slate-400">Oldest → newest · {ytData.videos.length} videos</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium">
              Area chart
            </span>
          </div>
          <div className="mt-4">
            <DarkAreaChart data={analytics.viewsChartData} color="#7c3aed" gradientId="yt-views" />
          </div>
        </BentoCard>
      )}

      {/* ── Row 5: Recency decay chart ── */}
      {vis.yt_recency_decay && analytics && analytics.recencyDecayData.length >= 3 && (
        <BentoCard>
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>Recency Decay</StatLabel>
              <p className="text-xs text-slate-400">Views on last 6 uploads (newest first)</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
              Area chart
            </span>
          </div>
          <div className="mt-4">
            <DarkAreaChart data={analytics.recencyDecayData} color="#f59e0b" gradientId="yt-decay" />
          </div>
        </BentoCard>
      )}

      {/* ── Row 6: Per-video feed table ── */}
      {vis.yt_video_feed && ytData.videos.length > 0 && (
        <BentoCard>
          <StatLabel>Video Feed</StatLabel>
          <p className="text-xs text-slate-400 mb-4">Most recent {Math.min(ytData.videos.length, 8)} uploads</p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Title", "Views", "Likes", "Comments", "Published"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ytData.videos]
                  .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
                  .slice(0, 8)
                  .map((v, i) => (
                    <tr key={v.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                      <td className="py-2.5 px-2 text-slate-300 max-w-[200px] truncate">{v.title ?? "—"}</td>
                      <td className="py-2.5 px-2 text-slate-300 font-semibold" style={MONO}>{fmtK(v.views)}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{fmtK(v.likes)}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{fmtK(v.comments)}</td>
                      <td className="py-2.5 px-2 text-slate-500" style={MONO}>
                        {new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── INSTAGRAM BENTO GRID ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

function parseGenderAge(raw: Record<string, number>) {
  let male = 0; let female = 0;
  const brackets: { label: string; pct: number; gender: "M" | "F" }[] = [];
  const total = Object.values(raw).reduce((s, v) => s + (v > 1 ? v : Math.round(v * 100)), 0) || 1;
  for (const [key, val] of Object.entries(raw)) {
    const pct = val > 1 ? Math.round(val) : Math.round(val * 100);
    const gender = key.startsWith("M.") ? "M" : "F";
    const ageRange = key.replace(/^[MF]\./, "");
    brackets.push({ label: `${gender} ${ageRange}`, pct, gender });
    if (gender === "M") male += pct;
    else female += pct;
  }
  brackets.sort((a, b) => b.pct - a.pct);
  return {
    male: Math.round((male / (male + female)) * 100) || 0,
    female: Math.round((female / (male + female)) * 100) || 0,
    brackets: brackets.slice(0, 8),
    donutSlices: brackets.slice(0, 6).map((b, i) => ({
      value: b.pct,
      label: b.label,
      color: b.gender === "M"
        ? ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"][Math.floor(i / 2)] ?? "#e0e7ff"
        : ["#ec4899", "#f472b6", "#f9a8d4", "#fce7f3"][Math.floor(i / 2)] ?? "#fdf2f8",
    })),
  };
}

function parseTopCountries(raw: Record<string, number>) {
  const total = Object.values(raw).reduce((s, v) => s + (v > 1 ? v : Math.round(v * 100)), 0) || 1;
  return Object.entries(raw)
    .map(([code, val]) => ({ label: code, value: val > 1 ? Math.round(val) : Math.round(val * 100), pct: val > 1 ? Math.round(val) : Math.round(val * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
}

function InstagramBentoGrid({
  igPlatform, igData, vis,
}: {
  igPlatform: PlatformInfo;
  igData: InstagramSnapshotData;
  vis: VisibilityConfig;
}) {
  const { account, posts, account_insights: ins } = igData;
  const hasInsights = !!ins;
  const hasReach = !!(ins?.reach_30d?.length);
  const reach30dTotal = hasReach ? ins!.reach_30d!.reduce((s, v) => s + v, 0) : 0;
  const hasCountry = !!(ins?.audience_country && Object.keys(ins.audience_country).length > 0);
  const hasAgeGender = !!(ins?.audience_gender_age && Object.keys(ins.audience_gender_age).length > 0);
  const postsWithInsights = posts.filter(p => p.reach !== undefined);
  const hasPostInsights = postsWithInsights.length > 0;

  const ga = hasAgeGender ? parseGenderAge(ins!.audience_gender_age!) : null;
  const countries = hasCountry ? parseTopCountries(ins!.audience_country!) : null;

  return (
    <div className="space-y-5">
      {/* Platform label row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-pink-500/20 flex items-center justify-center">
            <IconInstagram size={17} className="text-pink-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">@{account.username}</p>
            <p className="text-xs text-slate-500">{account.name}</p>
          </div>
        </div>
        <a href={`https://instagram.com/${account.username}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <IconExternal size={11} /> View profile
        </a>
      </div>

      {/* ── Row 1: Core stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {vis.ig_followers && (
          <BentoCard span="col-span-2" glow="pink" className="bg-gradient-to-br from-pink-500/10 via-transparent to-transparent border-pink-500/15">
            <div className="flex items-start justify-between mb-3">
              <StatLabel>Followers</StatLabel>
              <IconUsers size={14} className="text-pink-400" />
            </div>
            <StatValue size="2xl">{fmtK(account.followers_count)}</StatValue>
            <StatSub>Total followers</StatSub>
          </BentoCard>
        )}
        {vis.ig_posts && (
          <BentoCard>
            <StatLabel>Posts</StatLabel>
            <StatValue size="xl">{account.media_count.toLocaleString()}</StatValue>
            <StatSub>Total posts published</StatSub>
          </BentoCard>
        )}
        {vis.ig_reach_30d_total && hasReach && (
          <BentoCard glow="purple">
            <StatLabel>30-Day Reach</StatLabel>
            <StatValue size="xl">{fmtK(reach30dTotal)}</StatValue>
            <StatSub>unique accounts reached</StatSub>
          </BentoCard>
        )}
      </div>

      {/* ── Row 2: 30-day reach chart (full width) ── */}
      {vis.ig_reach_30d_chart && hasReach && (
        <BentoCard span="col-span-full" glow="pink">
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>30-Day Reach</StatLabel>
              <p className="text-xs text-slate-400">Daily unique accounts reached · last 30 days</p>
            </div>
            <div className="flex items-center gap-2">
              <VerifiedPill />
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 font-medium">
                Daily bar chart
              </span>
            </div>
          </div>
          <div className="mt-4">
            <DailyBarChart data={ins!.reach_30d!} color="#ec4899" />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-0.5">
            <span>30 days ago</span><span>Today</span>
          </div>
        </BentoCard>
      )}

      {/* ── Row 3: Activity insights (7d) ── */}
      {hasInsights && (vis.ig_profile_views_7d || vis.ig_website_clicks_7d) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {vis.ig_profile_views_7d && ins?.profile_views !== undefined && (
            <BentoCard>
              <StatLabel>Profile Views 7d</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.profile_views)}</StatValue>
              <StatSub>page visits this week</StatSub>
            </BentoCard>
          )}
          {vis.ig_website_clicks_7d && ins?.website_clicks !== undefined && (
            <BentoCard>
              <StatLabel>Website Clicks 7d</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.website_clicks)}</StatValue>
              <StatSub>link-in-bio taps</StatSub>
            </BentoCard>
          )}
          {ins?.account_reach !== undefined && (
            <BentoCard>
              <StatLabel>Account Reach</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.account_reach)}</StatValue>
              <StatSub>unique accounts</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 4: Audience — country + age/gender side by side ── */}
      {(hasCountry || hasAgeGender) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Country breakdown — horizontal bar chart */}
          {vis.ig_audience_country && countries && (
            <BentoCard>
              <div className="flex items-center justify-between mb-4">
                <StatLabel>Audience Country</StatLabel>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 font-medium">
                  Horizontal bar
                </span>
              </div>
              <HorizontalBarChart items={countries} color="#14b8a6" />
            </BentoCard>
          )}

          {/* Age/gender — donut + legend */}
          {vis.ig_audience_age_gender && ga && (
            <BentoCard>
              <div className="flex items-center justify-between mb-3">
                <StatLabel>Age & Gender</StatLabel>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 font-medium">
                  Donut chart
                </span>
              </div>
              <div className="flex items-center gap-5">
                {/* Donut */}
                <div className="shrink-0">
                  <DonutChart slices={ga.donutSlices} />
                </div>
                {/* Legend + gender bar */}
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="flex rounded-full overflow-hidden h-2 mb-1.5">
                      <div className="bg-indigo-400" style={{ width: `${ga.male}%` }} />
                      <div className="bg-pink-400 flex-1" />
                    </div>
                    <div className="flex gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />M {ga.male}%</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />F {ga.female}%</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {ga.brackets.slice(0, 4).map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 w-14 shrink-0" style={MONO}>{b.label}</span>
                        <div className="flex-1 bg-white/[0.06] rounded-full h-1 overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{ width: `${Math.min(b.pct * 2, 100)}%`, background: b.label.startsWith("M") ? "#818cf8" : "#f472b6" }} />
                        </div>
                        <span className="text-[10px] text-slate-500 w-7 text-right" style={MONO}>{b.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 5: Per-post feed table ── */}
      {vis.ig_post_feed && posts.length > 0 && (
        <BentoCard>
          <StatLabel>Post Feed</StatLabel>
          <p className="text-xs text-slate-400 mb-4">
            Recent {Math.min(posts.length, 9)} posts
            {hasPostInsights ? " — API-verified per-post insights" : " — engagement data"}
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["#", "Type", "Likes", "Comments",
                    ...(hasPostInsights ? ["Reach", "Saves", "Shares", "Follows", "Profile Visits"] : []),
                    "Date"].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.slice(0, 9).map((p, i) => (
                  <tr key={p.id} className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors`}>
                    <td className="py-2.5 px-2 text-slate-500" style={MONO}>{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        p.media_type === "VIDEO" ? "bg-red-500/10 text-red-400" :
                        p.media_type === "CAROUSEL_ALBUM" ? "bg-violet-500/10 text-violet-400" :
                        "bg-pink-500/10 text-pink-400"}`}>
                        {p.media_type === "CAROUSEL_ALBUM" ? "ALBUM" : p.media_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-slate-300 font-semibold" style={MONO}>{fmtK(p.like_count)}</td>
                    <td className="py-2.5 px-2 text-slate-400" style={MONO}>{fmtK(p.comments_count)}</td>
                    {hasPostInsights && <>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{p.reach !== undefined ? fmtK(p.reach) : "—"}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{p.saved !== undefined ? fmtK(p.saved) : "—"}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{p.shares !== undefined ? fmtK(p.shares) : "—"}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{p.follows !== undefined ? fmtK(p.follows) : "—"}</td>
                      <td className="py-2.5 px-2 text-slate-400" style={MONO}>{p.profile_visits !== undefined ? fmtK(p.profile_visits) : "—"}</td>
                    </>}
                    <td className="py-2.5 px-2 text-slate-500" style={MONO}>
                      {new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {/* ── Row 6: Stories breakdown ── */}
      {vis.ig_stories && igData.stories && igData.stories.length > 0 && (() => {
        const s = igData.stories;
        const totalReach = s.reduce((acc, st) => acc + (st.reach ?? 0), 0);
        const totalImpressions = s.reduce((acc, st) => acc + (st.impressions ?? 0), 0);
        const totalExits = s.reduce((acc, st) => acc + (st.exits ?? 0), 0);
        const totalReplies = s.reduce((acc, st) => acc + (st.replies ?? 0), 0);
        const totalTapsFwd = s.reduce((acc, st) => acc + (st.taps_forward ?? 0), 0);
        const totalTapsBack = s.reduce((acc, st) => acc + (st.taps_back ?? 0), 0);
        const exitRate = totalImpressions > 0 ? ((totalExits / totalImpressions) * 100).toFixed(1) : null;
        return (
          <BentoCard>
            <StatLabel>Stories Breakdown</StatLabel>
            <p className="text-xs text-slate-400 mb-4">Aggregated across {s.length} recent stories</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Reach",        value: fmtK(totalReach) },
                { label: "Impressions",  value: fmtK(totalImpressions) },
                { label: "Exit Rate",    value: exitRate ? `${exitRate}%` : "—" },
                { label: "Replies",      value: fmtK(totalReplies) },
                { label: "Taps Fwd",     value: fmtK(totalTapsFwd) },
                { label: "Taps Back",    value: fmtK(totalTapsBack) },
              ].map(m => (
                <div key={m.label} className="bg-white/[0.03] rounded-xl p-3 border border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-1">{m.label}</p>
                  <p className="text-lg font-bold text-slate-200" style={MONO}>{m.value}</p>
                </div>
              ))}
            </div>
          </BentoCard>
        );
      })()}

      {/* ── Row 7: Recent posts image grid ── */}
      {posts.length > 0 && (
        <BentoCard>
          <StatLabel>Recent Posts</StatLabel>
          <p className="text-xs text-slate-400 mb-4">Latest {Math.min(posts.length, 9)} · hover for metrics</p>
          <div className="grid grid-cols-3 gap-2">
            {posts.slice(0, 9).map(post => {
              const thumb = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
              return (
                <div key={post.id} className="relative aspect-square rounded-xl overflow-hidden bg-white/[0.04] group border border-white/[0.06]">
                  {thumb
                    ? <img src={thumb} alt={post.caption ?? "Post"} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center">
                        <IconInstagram size={22} className="text-pink-400/40" />
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2 text-white text-[11px] font-semibold" style={MONO}>
                    <span>♥ {fmtK(post.like_count)}</span>
                    <span>💬 {fmtK(post.comments_count)}</span>
                    {post.reach         !== undefined && <span>👁 {fmtK(post.reach)}</span>}
                    {post.saved         !== undefined && <span>🔖 {fmtK(post.saved)}</span>}
                    {post.shares        !== undefined && <span>↗ {fmtK(post.shares)}</span>}
                    {post.follows       !== undefined && <span>➕ {fmtK(post.follows)}</span>}
                    {post.profile_visits !== undefined && <span>👤 {fmtK(post.profile_visits)}</span>}
                  </div>
                  {post.media_type === "VIDEO" && <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">▶</div>}
                  {post.media_type === "CAROUSEL_ALBUM" && <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">⊞</div>}
                </div>
              );
            })}
          </div>
        </BentoCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PAGE COMPONENT ────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export default async function CreatorPublicProfile(
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const username = resolveHandle(handle);
  if (!username) return notFound();

  const data = await getProfile(username);
  if (!data) return notFound();

  const { profile, platforms, snapshots } = data;

  if (profile.user_type === "business") redirect(`/b/@${username}`);

  // Derive visibility config from profile.metric_visibility
  const mv: MetricVisibility = (profile.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;
  const vis = igToVis(mv);

  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const igPlatform = platforms.find(p => p.platform === "instagram") ?? null;
  const ytSnap = snapshots["youtube"];
  const igSnap = snapshots["instagram"];
  const ytData: SnapshotData | null = (ytSnap?.data as unknown as SnapshotData) ?? null;
  const igData: InstagramSnapshotData | null = (igSnap?.data as unknown as InstagramSnapshotData) ?? null;
  const capturedAt = ytSnap?.captured_at ?? igSnap?.captured_at ?? null;

  const rootClass = [
    playfair.variable,
    jetbrains.variable,
    "min-h-screen font-sans",
  ].join(" ");

  return (
    <div className={rootClass} style={{ background: "#070c18", color: "#e2e8f0" }}>

      {/* ── Sticky top nav ── */}
      <nav className="sticky top-0 z-30 border-b border-white/[0.06]"
        style={{ background: "rgba(7,12,24,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <img src="/brand/logo-icon.svg" width={12} height={12} alt="Statvora" />
            </div>
            <span className="text-sm font-bold text-slate-200">Statvora</span>
          </a>
          <div className="flex items-center gap-3">
            <ShareButton />
            <a href={`/login?intent=contact&creator=${username}`}
              className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 transition-all">
              Work With Me
            </a>
          </div>
        </div>
      </nav>

      <TrackView username={username} />

      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-8 space-y-6">

        {/* Hero */}
        <HeroSection
          profile={profile}
          platforms={platforms}
          capturedAt={capturedAt}
          username={username}
        />

        {/* No platforms connected yet */}
        {!ytPlatform && !igPlatform && (
          <BentoCard>
            <div className="py-10 text-center">
              <p className="text-slate-400 font-medium mb-1">No platforms connected yet</p>
              <p className="text-sm text-slate-600">This creator hasn&apos;t linked any platform accounts.</p>
            </div>
          </BentoCard>
        )}

        {/* ── YouTube ── */}
        {ytPlatform && (
          <>
            <PlatformDivider platform="YouTube" icon={IconYoutube} color="border-red-500/20 bg-red-500/[0.07] text-red-400" />
            {ytData
              ? <YouTubeBentoGrid ytPlatform={ytPlatform} ytData={ytData} vis={vis} />
              : (
                <BentoCard>
                  <div className="py-10 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                      <IconYoutube size={18} className="text-red-400" />
                    </div>
                    <p className="text-slate-400 font-medium">YouTube connected</p>
                    <p className="text-sm text-slate-600">Metrics will appear after the creator visits their dashboard.</p>
                  </div>
                </BentoCard>
              )
            }
          </>
        )}

        {/* ── Instagram ── */}
        {igPlatform && (
          <>
            <PlatformDivider platform="Instagram" icon={IconInstagram} color="border-pink-500/20 bg-pink-500/[0.07] text-pink-400" />
            {igData
              ? <InstagramBentoGrid igPlatform={igPlatform} igData={igData} vis={vis} />
              : (
                <BentoCard>
                  <div className="py-10 text-center space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto">
                      <IconInstagram size={18} className="text-pink-400" />
                    </div>
                    <p className="text-slate-400 font-medium">Instagram connected</p>
                    <p className="text-sm text-slate-600">Metrics will appear after the creator visits their dashboard.</p>
                  </div>
                </BentoCard>
              )
            }
          </>
        )}

        {/* About card */}
        {(profile.creator_stage || profile.aspiration || profile.website) && (
          <BentoCard>
            <StatLabel>About</StatLabel>
            <dl className="space-y-2.5 mt-2">
              {profile.creator_stage && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Creator stage</dt>
                  <dd className="font-medium text-slate-300">{stageLabels[profile.creator_stage] ?? profile.creator_stage}</dd>
                </div>
              )}
              {profile.aspiration && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Aspiration</dt>
                  <dd className="font-medium text-slate-300">{profile.aspiration.replace(/_/g, " ")}</dd>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Website</dt>
                  <dd>
                    <a href={profile.website} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1">
                      {profile.website.replace(/^https?:\/\//, "")} <IconExternal size={10} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </BentoCard>
        )}

        {/* Footer CTA */}
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-slate-500">
            Powered by <a href="/" className="text-violet-400 hover:text-violet-300 font-medium">Statvora</a> — verified creator analytics
          </p>
          <a href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 transition-all shadow-xl shadow-violet-900/30">
            Create your verified creator profile →
          </a>
        </div>

      </main>
    </div>
  );
}
