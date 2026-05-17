import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Playfair_Display, JetBrains_Mono } from "next/font/google";
import { timeAgo } from "@/lib/utils";
import {
  Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY,
  SnapshotData, InstagramSnapshotData,
} from "@/lib/api";
import { fmt } from "@/lib/utils";
import {
  IconYoutube, IconInstagram, IconExternal, IconShield,
} from "@/components/ui/Icons";
import { ShareButton } from "./_components/ShareButton";
import { TrackView } from "./_components/TrackView";
import { VisibilityConfig, BentoCard, StatLabel, MONO } from "./_components/bento-shared";
import { YouTubeBentoGrid } from "./_components/YouTubeBentoGrid";
import { InstagramBentoGrid } from "./_components/InstagramBentoGrid";

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
// Mock data reference
//
// Every metric carries `isVisible: boolean`. In production, `isVisible` is
// derived from profile.metric_visibility (YouTube) and platform privacy
// settings (Instagram). The structure below is the canonical shape — use it
// as a reference when wiring up new metrics or writing tests.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CREATOR = {
  profile: {
    full_name: "Alex Rivera", username: "alexrivera",
    bio: "Tech reviews & lifestyle vlogs. Helping 800K+ humans cut through the noise.",
    category: "Tech & Lifestyle", creator_stage: "established",
    website: "https://alexrivera.co",
  },
  youtube: {
    subscribers:           { value: 847_200,      isVisible: true  },
    totalViews:            { value: 124_800_000,  isVisible: true  },
    videoCount:            { value: 342,           isVisible: true  },
    avgViews:              { value: 365_000,       isVisible: true  },
    contentSpanDays:       { value: 2_847,         isVisible: true  },
    subToViewRatio:        { value: 147.3,         isVisible: true  },
    ghostViews:            { value: 3_200_000,     isVisible: true  },
    uploadVelocityDays:    { value: 8.3,           isVisible: true  },
    avgEngagementPct:      { value: 4.2,           isVisible: true  },
    viewsChartData:        { value: [280000, 310000, 295000, 340000, 365000, 320000, 410000, 390000, 450000, 380000], isVisible: true },
    recencyDecayData:      { value: [450000, 390000, 320000, 280000, 195000, 140000], isVisible: true },
    videoFeed: {
      isVisible: true,
      value: [
        { id: "1", title: "I tested every budget phone in 2025",     views: 1_240_000, likes: 38_200, comments: 1_840, publishedAt: "2025-04-12" },
        { id: "2", title: "The laptop I use to run my whole business",views:   890_000, likes: 27_100, comments:   920, publishedAt: "2025-03-28" },
        { id: "3", title: "Why I almost quit YouTube (honest)",       views: 2_100_000, likes: 91_400, comments: 4_210, publishedAt: "2025-03-10" },
        { id: "4", title: "48h productivity challenge — full results",views:   650_000, likes: 18_800, comments:   760, publishedAt: "2025-02-22" },
        { id: "5", title: "Honest AI tools tier list 2025",           views: 1_050_000, likes: 34_600, comments: 2_100, publishedAt: "2025-02-05" },
      ],
    },
  },
  instagram: {
    followers:           { value: 124_700,    isVisible: true },
    posts:               { value: 892,        isVisible: true },
    reach30dData:        { value: [18200,19400,17800,21000,24500,23100,20800,19600,22300,25100,24000,21700,20400,19800,23500,26000,25400,22100,21000,23800,27300,26100,24800,23200,22600,24100,26800,25300,23900,22400], isVisible: true },
    reach30dTotal:       { value: 1_241_600,  isVisible: true },
    profileViews7d:      { value: 8_420,      isVisible: true },
    websiteClicks7d:     { value: 1_230,      isVisible: true },
    audienceCountry:     { value: { IN: 45, US: 22, GB: 8, CA: 6, AU: 4 }, isVisible: true },
    audienceAgeGender:   { value: { "M.18-24": 15, "M.25-34": 22, "M.35-44": 8, "F.18-24": 18, "F.25-34": 28, "F.35-44": 9 }, isVisible: true },
    postFeed: {
      isVisible: true,
      value: [
        { id: "p1", caption: "New gear arrived", media_type: "IMAGE",          like_count: 4_820, comments_count: 312, reach: 31_400, saved: 890, shares: 210, follows: 48, profile_visits: 1_240, total_interactions: 6_280 },
        { id: "p2", caption: "AI workflow",       media_type: "VIDEO",          like_count: 7_100, comments_count: 541, reach: 52_000, saved: 1_540, shares: 420, follows: 92, profile_visits: 2_180, total_interactions: 9_693 },
        { id: "p3", caption: "Studio tour 2025",  media_type: "CAROUSEL_ALBUM", like_count: 3_210, comments_count: 198, reach: 24_800, saved: 670, shares: 145, follows: 31, profile_visits: 840,   total_interactions: 4_254 },
      ],
    },
    stories: {
      isVisible: true,
      value: { reach: 14_200, impressions: 18_600, exits: 820, replies: 94, taps_forward: 3_100, taps_back: 410 },
    },
  },
} as const;

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
  const name      = profile.full_name ?? `@${profile.username}`;
  const ytChannel = snapshots["youtube"]?.data?.channel;
  const subCount  = ytChannel?.subscribers;
  const category  = profile.category ? `${profile.category} creator` : "creator";
  const ogTitle   = `${name} — Verified ${category} profile on Statvora`;

  const descParts: string[] = [];
  if (subCount)   descParts.push(`${fmt(subCount)} YouTube subscribers`);
  if (profile.bio) descParts.push(profile.bio);
  descParts.push("All metrics verified directly from YouTube's API — no self-reported numbers.");
  const description = descParts.join(". ").slice(0, 160);
  const pageUrl = `${APP_URL}/@${username}`;

  return {
    title: ogTitle,
    description,
    alternates: { canonical: pageUrl },
    openGraph: { type: "profile", siteName: "Statvora", title: ogTitle, description, url: pageUrl },
    twitter: { card: "summary_large_image", title: ogTitle, description },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DISPLAY: React.CSSProperties = { fontFamily: "var(--font-playfair)" };

const stageLabels: Record<string, string> = {
  just_starting: "Just Starting", growing: "Growing Fast",
  established: "Established",    pro: "Pro Creator",
};

/** Maps profile.metric_visibility → the unified VisibilityConfig used by both grids */
function buildVisibility(mv: MetricVisibility): VisibilityConfig {
  return {
    yt_subscribers: mv.subscribers, yt_total_views: mv.total_views,
    yt_video_count: mv.video_count, yt_avg_views: mv.avg_views,
    yt_content_span: mv.avg_views,  yt_sub_view_ratio: mv.avg_views,
    yt_ghost_views: mv.total_views, yt_upload_velocity: mv.avg_views,
    yt_avg_engagement: mv.avg_views,
    yt_views_by_video: mv.view_chart, yt_recency_decay: mv.view_chart,
    yt_video_feed: mv.recent_videos,
    ig_followers: true,           ig_posts: true,
    ig_reach_30d_chart: true,     ig_reach_30d_total: true,
    ig_profile_views_7d: true,    ig_website_clicks_7d: true,
    ig_audience_country: true,    ig_audience_age_gender: true,
    ig_post_feed: true,           ig_stories: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero section
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({
  profile, platforms, capturedAt, username,
}: {
  profile: Profile;
  platforms: PlatformInfo[];
  capturedAt: string | null;
  username: string;
}) {
  const initials   = (profile.full_name?.[0] ?? profile.username?.[0] ?? "?").toUpperCase();
  const ytLinked   = platforms.some(p => p.platform === "youtube");
  const igLinked   = platforms.some(p => p.platform === "instagram");

  return (
    <div className="relative rounded-3xl overflow-hidden border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-slate-950/80">
      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-pink-600/10 blur-3xl" />
      </div>

      <div className="relative z-10 p-7 md:p-9">
        <div className="flex flex-col md:flex-row md:items-start gap-6">

          {/* Avatar */}
          <div
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0 text-3xl font-bold text-white shadow-xl"
            style={DISPLAY}
          >
            {initials}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1
                className="text-3xl md:text-4xl font-bold text-slate-50 tracking-tight"
                style={DISPLAY}
              >
                {profile.full_name ?? `@${profile.username}`}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <IconShield size={8} /> Verified
              </span>
            </div>

            <p className="text-sm text-slate-400 mb-3" style={MONO}>
              @{profile.username}
            </p>

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
              {ytLinked && (
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-medium">
                  <IconYoutube size={11} /> YouTube
                </span>
              )}
              {igLinked && (
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

          {/* CTA buttons */}
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
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 rounded-xl text-sm font-medium border border-white/[0.1] text-slate-400 hover:text-slate-200 hover:border-white/[0.2] transition-all whitespace-nowrap flex items-center gap-1.5"
              >
                <IconExternal size={12} /> Website
              </a>
            )}
          </div>
        </div>

        {/* Verified notice + share */}
        <div className="mt-5 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/[0.07] border border-emerald-500/[0.15]">
          <IconShield size={13} className="text-emerald-400 shrink-0" />
          <p className="text-[11px] text-emerald-400 flex-1">
            All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported or estimated.
          </p>
          <ShareButton />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Section divider
// ─────────────────────────────────────────────────────────────────────────────

function PlatformDivider({
  platform, icon: Icon, color,
}: {
  platform: string;
  icon: React.ElementType;
  color: string;
}) {
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
// Page
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

  const mv: MetricVisibility =
    (profile.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;
  const vis = buildVisibility(mv);

  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const igPlatform = platforms.find(p => p.platform === "instagram") ?? null;
  const ytSnap     = snapshots["youtube"];
  const igSnap     = snapshots["instagram"];
  const ytData     = (ytSnap?.data as unknown as SnapshotData)             ?? null;
  const igData     = (igSnap?.data as unknown as InstagramSnapshotData)    ?? null;
  const capturedAt = ytSnap?.captured_at ?? igSnap?.captured_at ?? null;

  return (
    <div
      className={`${playfair.variable} ${jetbrains.variable} min-h-screen font-sans`}
      style={{ background: "#070c18", color: "#e2e8f0" }}
    >
      {/* Sticky nav */}
      <nav
        className="sticky top-0 z-30 border-b border-white/[0.06]"
        style={{ background: "rgba(7,12,24,0.85)", backdropFilter: "blur(16px)" }}
      >
        <div className="max-w-4xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
              <img src="/brand/logo-icon.svg" width={12} height={12} alt="Statvora" />
            </div>
            <span className="text-sm font-bold text-slate-200">Statvora</span>
          </a>
          <div className="flex items-center gap-3">
            <ShareButton />
            <a
              href={`/login?intent=contact&creator=${username}`}
              className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 transition-all"
            >
              Work With Me
            </a>
          </div>
        </div>
      </nav>

      <TrackView username={username} />

      <main className="max-w-4xl mx-auto px-4 sm:px-5 py-8 space-y-6">

        <HeroSection
          profile={profile}
          platforms={platforms}
          capturedAt={capturedAt}
          username={username}
        />

        {/* No platforms connected */}
        {!ytPlatform && !igPlatform && (
          <BentoCard>
            <div className="py-10 text-center">
              <p className="text-slate-400 font-medium mb-1">No platforms connected yet</p>
              <p className="text-sm text-slate-600">
                This creator hasn&apos;t linked any platform accounts.
              </p>
            </div>
          </BentoCard>
        )}

        {/* ── YouTube ── */}
        {ytPlatform && (
          <>
            <PlatformDivider
              platform="YouTube"
              icon={IconYoutube}
              color="border-red-500/20 bg-red-500/[0.07] text-red-400"
            />
            {ytData ? (
              <YouTubeBentoGrid ytPlatform={ytPlatform} ytData={ytData} vis={vis} />
            ) : (
              <BentoCard>
                <div className="py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                    <IconYoutube size={18} className="text-red-400" />
                  </div>
                  <p className="text-slate-400 font-medium">YouTube connected</p>
                  <p className="text-sm text-slate-600">
                    Metrics will appear after the creator visits their dashboard.
                  </p>
                </div>
              </BentoCard>
            )}
          </>
        )}

        {/* ── Instagram ── */}
        {igPlatform && (
          <>
            <PlatformDivider
              platform="Instagram"
              icon={IconInstagram}
              color="border-pink-500/20 bg-pink-500/[0.07] text-pink-400"
            />
            {igData ? (
              <InstagramBentoGrid igPlatform={igPlatform} igData={igData} vis={vis} />
            ) : (
              <BentoCard>
                <div className="py-10 text-center space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mx-auto">
                    <IconInstagram size={18} className="text-pink-400" />
                  </div>
                  <p className="text-slate-400 font-medium">Instagram connected</p>
                  <p className="text-sm text-slate-600">
                    Metrics will appear after the creator visits their dashboard.
                  </p>
                </div>
              </BentoCard>
            )}
          </>
        )}

        {/* About */}
        {(profile.creator_stage || profile.aspiration || profile.website) && (
          <BentoCard>
            <StatLabel>About</StatLabel>
            <dl className="space-y-2.5 mt-2">
              {profile.creator_stage && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Creator stage</dt>
                  <dd className="font-medium text-slate-300">
                    {stageLabels[profile.creator_stage] ?? profile.creator_stage}
                  </dd>
                </div>
              )}
              {profile.aspiration && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Aspiration</dt>
                  <dd className="font-medium text-slate-300">
                    {profile.aspiration.replace(/_/g, " ")}
                  </dd>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-slate-500">Website</dt>
                  <dd>
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1"
                    >
                      {profile.website.replace(/^https?:\/\//, "")}
                      <IconExternal size={10} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </BentoCard>
        )}

        {/* Footer */}
        <div className="text-center py-6 space-y-4">
          <p className="text-sm text-slate-500">
            Powered by{" "}
            <a href="/" className="text-violet-400 hover:text-violet-300 font-medium">
              Statvora
            </a>{" "}
            — verified creator analytics
          </p>
          <a
            href="/signup"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-pink-600 text-white hover:from-violet-500 hover:to-pink-500 transition-all shadow-xl shadow-violet-900/30"
          >
            Create your verified creator profile →
          </a>
        </div>

      </main>
    </div>
  );
}
