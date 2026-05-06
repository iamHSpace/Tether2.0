import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fmt, timeAgo } from "@/lib/utils";
import { Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY, SnapshotData } from "@/lib/api";
import {
  IconYoutube, IconExternal, IconShield,
  IconUsers, IconEye, IconVideo, IconTrendUp,
} from "@/components/ui/Icons";
import { ShareButton } from "./_components/ShareButton";
import { VideoList } from "./_components/VideoList";
import { TrackView } from "./_components/TrackView";

export const revalidate = 300;

// ── Server-side data fetch ─────────────────────────────────────────────────────

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

interface CreatorData {
  profile: Profile;
  platforms: PlatformInfo[];
  snapshots: Record<string, { data: SnapshotData; captured_at: string }>;
}

async function getCreator(username: string): Promise<CreatorData | null> {
  const res = await fetch(`${BACKEND}/api/creators/${encodeURIComponent(username)}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

// ── SEO metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  const data = await getCreator(username).catch(() => null);
  if (!data) return { title: "Creator not found" };

  const { profile, snapshots } = data;
  const name = profile.full_name ?? `@${profile.username}`;
  const ytChannel = snapshots["youtube"]?.data?.channel;
  const subCount = ytChannel?.subscribers;
  const category = profile.category ? `${profile.category} creator` : "creator";

  // Title: aim for 50-60 chars — include category and platform context
  const ogTitle = `${name} — Verified ${category} profile on Tether`;

  // Description: aim for 110-160 chars — include metrics and CTA
  const descParts: string[] = [];
  if (subCount) descParts.push(`${fmt(subCount)} YouTube subscribers`);
  if (profile.bio) descParts.push(profile.bio);
  descParts.push("All metrics verified directly from YouTube's API — no self-reported numbers.");
  const richDescription = descParts.join(". ").slice(0, 160);

  const pageUrl = `https://tether-frontend.vercel.app/c/${username}`;

  return {
    title: ogTitle,
    description: richDescription,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "profile",
      siteName: "Tether",
      title: ogTitle,
      description: richDescription,
      url: pageUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: richDescription,
    },
  };
}

// ── Bezier area chart (pure SVG, no interactivity) ────────────────────────────

function AreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return null;
  const W = 500; const H = 80;
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [(i / (data.length - 1)) * W, H - 8 - ((v - min) / range) * (H - 16)]);
  let linePath = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const cpX = (pts[i - 1][0] + pts[i][0]) / 2;
    linePath += ` C ${cpX},${pts[i - 1][1]} ${cpX},${pts[i][1]} ${pts[i][0]},${pts[i][1]}`;
  }
  const areaPath = `${linePath} L ${pts[pts.length - 1][0]},${H} L ${pts[0][0]},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarChart({ data, color = "#7c3aed" }: { data: { label: string; value: number; sublabel?: string }[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const H = 70; const labelH = 24; const gap = 3;
  const barW = Math.max(8, (260 - gap * (data.length - 1)) / data.length);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * (barW + gap)} ${H + labelH}`} width="100%"
        style={{ minWidth: data.length * 26 }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const bH = Math.max(2, (d.value / max) * H);
          const x = i * (barW + gap);
          return (
            <g key={i}>
              <rect x={x} y={H - bH} width={barW} height={bH} rx="3" fill={color} opacity={d.value === max ? "1" : "0.5"} />
              <text x={x + barW / 2} y={H + 11} textAnchor="middle" fontSize="7" fill="#9ca3af">{d.label}</text>
              {d.sublabel && <text x={x + barW / 2} y={H + 20} textAnchor="middle" fontSize="6" fill="#d1d5db">{d.sublabel}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, bg, iconColor }: {
  icon: React.ElementType; label: string; value: string; sub?: string; bg: string; iconColor: string;
}) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-1 border border-white/60 ${bg}`}>
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center bg-white/50 mb-0.5 ${iconColor}`}>
        <Icon size={13} />
      </div>
      <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

function InsightCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white/60 rounded-xl p-3 border border-white/80">
      <p className="text-base font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
    </div>
  );
}

// ── Analytics helpers ──────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeAnalytics(ytData: SnapshotData) {
  const videos = ytData.videos;
  const ch = ytData.channel;
  if (!videos.length) return null;

  const sorted = [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const accountAgeDays = sorted.length > 1
    ? Math.round((new Date(sorted[sorted.length - 1].publishedAt).getTime() - new Date(sorted[0].publishedAt).getTime()) / 86400000)
    : 0;
  const uploadVelocity = sorted.length > 1 ? accountAgeDays / (sorted.length - 1) : 0;
  const knownViews = videos.reduce((s, v) => s + v.views, 0);
  const ghostViews = Math.max(0, ch.totalViews - knownViews);
  const subToViewRatio = ch.subscribers > 0 ? ch.totalViews / ch.subscribers : 0;

  const withMetrics = videos.map(v => ({
    ...v,
    engagementScore: v.likes * 2 + v.comments,
    interactionRate: v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0,
    viewContrib: ch.totalViews > 0 ? (v.views / ch.totalViews) * 100 : 0,
    commentDensity: v.views > 0 ? (v.comments / v.views) * 100 : 0,
  }));

  const weekdayBuckets = WEEKDAYS.map((day, i) => {
    const dayVids = videos.filter(v => new Date(v.publishedAt).getDay() === i);
    return { label: day, value: dayVids.length > 0 ? Math.round(dayVids.reduce((s, v) => s + v.views, 0) / dayVids.length) : 0, sublabel: `${dayVids.length}v` };
  });

  const monthCounts: Record<string, number> = {};
  for (const v of videos) {
    const key = new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  }
  const monthlyUploads = Object.entries(monthCounts).map(([label, value]) => ({ label, value }));
  const recentDecay = [...sorted].reverse().slice(0, 6).map(v => ({ value: v.views }));

  const titleBuckets = [
    { label: "Short", sublabel: "<30",   vids: withMetrics.filter(v => (v.title?.length ?? 0) < 30) },
    { label: "Med",   sublabel: "30-60", vids: withMetrics.filter(v => (v.title?.length ?? 0) >= 30 && (v.title?.length ?? 0) <= 60) },
    { label: "Long",  sublabel: ">60",   vids: withMetrics.filter(v => (v.title?.length ?? 0) > 60) },
  ].map(b => ({ label: b.label, sublabel: b.sublabel, value: b.vids.length > 0 ? Math.round(b.vids.reduce((s, v) => s + v.engagementScore, 0) / b.vids.length) : 0 }));

  const groups: Record<string, SnapshotData["videos"]> = {};
  for (const v of videos) {
    if (!v.title) continue;
    const words = v.title.toLowerCase().split(/\s+/);
    for (let len = 2; len <= Math.min(4, words.length - 1); len++) {
      const key = words.slice(0, len).join(" ");
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }
  }
  const series = Object.entries(groups)
    .filter(([, vids]) => vids.length >= 2)
    .map(([name, vids]) => ({ name: name.replace(/\b\w/g, c => c.toUpperCase()), videos: vids }))
    .sort((a, b) => b.videos.length - a.videos.length)
    .slice(0, 4);

  return { accountAgeDays, uploadVelocity, ghostViews, subToViewRatio, withMetrics, weekdayBuckets, monthlyUploads, recentDecay, titleBuckets, series };
}

// ── Stage labels ───────────────────────────────────────────────────────────────

const stageLabels: Record<string, string> = {
  just_starting: "Just starting out",
  growing:       "Growing fast",
  established:   "Established creator",
  pro:           "Pro creator",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function CreatorPublicProfile(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const data = await getCreator(username);

  if (!data) notFound();

  const { profile, platforms, snapshots } = data;
  const mv: MetricVisibility = (profile.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;
  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const ytSnap = snapshots["youtube"];
  const ytData: SnapshotData | null = ytSnap?.data ?? null;
  const capturedAt = ytSnap?.captured_at ?? null;
  const analytics = ytData ? computeAnalytics(ytData) : null;
  const hasAnyVisible = mv.subscribers || mv.total_views || mv.video_count || mv.avg_views || mv.view_chart || mv.recent_videos;
  const initials = (profile.full_name?.[0] ?? profile.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Tether</span>
          </a>
          <ShareButton />
        </div>
      </nav>

      <TrackView username={username} />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-5">

        {/* Hero */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card">
          <div className="flex items-start gap-5">
            <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white text-2xl font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{profile.full_name ?? `@${profile.username}`}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                  <IconShield size={9} /> Verified
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{profile.bio}</p>}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {profile.category && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 font-medium border border-purple-100">
                    {profile.category}
                  </span>
                )}
                {profile.creator_stage && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium border border-brand-100">
                    {stageLabels[profile.creator_stage] ?? profile.creator_stage}
                  </span>
                )}
                {ytPlatform && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">
                    <IconYoutube size={10} /> YouTube
                  </span>
                )}
              </div>
            </div>
            <a href="/login" className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              Join Tether
            </a>
          </div>
        </div>

        {/* Verified notice */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-green-50 border border-green-100">
          <IconShield size={15} className="text-green-600 shrink-0" />
          <div className="flex-1">
            <p className="text-xs text-green-700">
              All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported.
              {capturedAt && <span className="text-green-500 ml-1">Metrics updated {timeAgo(capturedAt)}.</span>}
            </p>
            {profile.updated_at && (
              <p className="text-[11px] text-green-500 mt-0.5">Profile last updated {timeAgo(profile.updated_at)}.</p>
            )}
          </div>
        </div>

        {/* No platforms connected */}
        {!ytPlatform && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center">
            <p className="text-sm font-medium text-gray-500 mb-1">No platforms connected yet</p>
            <p className="text-xs text-gray-400">This creator hasn&apos;t linked any platform accounts.</p>
          </div>
        )}

        {/* YouTube: connected but no snapshot */}
        {ytPlatform && !ytData && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <IconYoutube size={18} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">YouTube connected</p>
            <p className="text-xs text-gray-400">Metrics will appear here after the creator refreshes their dashboard.</p>
          </div>
        )}

        {/* YouTube section */}
        {ytPlatform && ytData && (
          <div className="space-y-4">
            {/* Platform header */}
            <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
                  <IconYoutube size={17} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{ytPlatform.platform_username}</p>
                  {ytData.channel.handle && <p className="text-xs text-gray-400">{ytData.channel.handle}</p>}
                </div>
              </div>
              <a href={`https://youtube.com/channel/${ytPlatform.platform_user_id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <IconExternal size={11} /> View on YouTube
              </a>
            </div>

            {/* Creator hid all metrics */}
            {!hasAnyVisible && (
              <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-200 text-center">
                <p className="text-sm text-gray-400">Creator has chosen not to share metrics publicly.</p>
              </div>
            )}

            {/* Channel overview cards */}
            {(mv.subscribers || mv.total_views || mv.video_count || mv.avg_views) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mv.subscribers && (
                  <MetricCard icon={IconUsers} label="Subscribers" value={fmt(ytData.channel.subscribers)} bg="bg-[#e8f5f0]" iconColor="text-emerald-600" />
                )}
                {mv.total_views && (
                  <MetricCard icon={IconEye} label="Total Views" value={fmt(ytData.channel.totalViews)}
                    sub={analytics ? `${fmt(analytics.ghostViews)} from unlisted` : undefined} bg="bg-[#fef9ec]" iconColor="text-amber-500" />
                )}
                {mv.video_count && (
                  <MetricCard icon={IconVideo} label="Videos" value={fmt(ytData.channel.videoCount)} bg="bg-[#f0f0fe]" iconColor="text-brand-600" />
                )}
                {mv.avg_views && (
                  <MetricCard icon={IconTrendUp} label="Avg Views/Video"
                    value={fmt(Math.round(ytData.channel.totalViews / Math.max(ytData.channel.videoCount, 1)))} bg="bg-[#fdf0f3]" iconColor="text-rose-500" />
                )}
              </div>
            )}

            {/* Derived insights */}
            {mv.avg_views && analytics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InsightCard label="Sub-to-View Ratio" value={`${Math.round(analytics.subToViewRatio * 10) / 10}×`} sub="views per subscriber" />
                <InsightCard label="Ghost Views" value={fmt(analytics.ghostViews)} sub="from unlisted/older videos" />
                <InsightCard label="Upload Velocity" value={analytics.uploadVelocity > 0 ? `${Math.round(analytics.uploadVelocity * 10) / 10}d` : "—"} sub="avg days between uploads" />
                <InsightCard label="Content Span"
                  value={analytics.accountAgeDays > 0 ? `${analytics.accountAgeDays}d` : "—"}
                  sub={`across ${ytData.videos.length} videos`} />
              </div>
            )}

            {/* Charts */}
            {mv.view_chart && analytics && ytData.videos.length >= 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Views by Video</h3>
                    <p className="text-xs text-gray-400 mb-3">Oldest → newest ({ytData.videos.length} videos)</p>
                    <AreaChart
                      data={[...ytData.videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).map(v => v.views)}
                      color="#7c3aed" gradientId="pub-views" />
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Recency Decay</h3>
                    <p className="text-xs text-gray-400 mb-3">Views on last 6 uploads (newest first)</p>
                    <AreaChart data={analytics.recentDecay.map(d => d.value)} color="#f59e0b" gradientId="pub-decay" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-xs font-bold text-gray-900 mb-1">Publishing Momentum</h3>
                    <p className="text-[10px] text-gray-400 mb-3">Uploads per month</p>
                    <BarChart data={analytics.monthlyUploads} color="#7c3aed" />
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-xs font-bold text-gray-900 mb-1">Best Day to Post</h3>
                    <p className="text-[10px] text-gray-400 mb-3">Avg views by weekday</p>
                    <BarChart data={analytics.weekdayBuckets} color="#10b981" />
                  </div>
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-xs font-bold text-gray-900 mb-1">Title Length vs Engagement</h3>
                    <p className="text-[10px] text-gray-400 mb-3">Avg engagement by title length</p>
                    <BarChart data={analytics.titleBuckets} color="#f59e0b" />
                  </div>
                </div>

                {mv.video_count && analytics.series.length > 0 && (
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-3">Content Series</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {analytics.series.map(s => {
                        const avgViews = Math.round(s.videos.reduce((sum, v) => sum + v.views, 0) / s.videos.length);
                        const avgEng = Math.round(s.videos.reduce((sum, v) => sum + v.likes * 2 + v.comments, 0) / s.videos.length);
                        return (
                          <div key={s.name} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                            <p className="text-xs font-bold text-gray-800 truncate">{s.name}…</p>
                            <p className="text-[10px] text-gray-400 mb-2">{s.videos.length} videos</p>
                            <div className="space-y-0.5 text-xs">
                              <div className="flex justify-between"><span className="text-gray-400">Avg views</span><span className="font-semibold">{fmt(avgViews)}</span></div>
                              <div className="flex justify-between"><span className="text-gray-400">Avg engagement</span><span className="font-semibold">{fmt(avgEng)}</span></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Post activity (interactive client island) */}
            {mv.recent_videos && analytics && (
              <VideoList videos={analytics.withMetrics} totalCount={ytData.videos.length} />
            )}
          </div>
        )}

        {/* About */}
        {(profile.creator_stage || profile.aspiration || profile.website) && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">About</h2>
            <dl className="space-y-2">
              {profile.creator_stage && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Creator stage</dt>
                  <dd className="font-medium text-gray-800">{stageLabels[profile.creator_stage] ?? profile.creator_stage}</dd>
                </div>
              )}
              {profile.aspiration && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Aspiration</dt>
                  <dd className="font-medium text-gray-800">{profile.aspiration.replace(/_/g, " ")}</dd>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Website</dt>
                  <dd>
                    <a href={profile.website} target="_blank" rel="noopener noreferrer"
                      className="font-medium text-brand-600 hover:underline flex items-center gap-1">
                      {profile.website.replace(/^https?:\/\//, "")} <IconExternal size={10} />
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400 mb-3">Powered by <a href="/" className="text-brand-600 font-medium hover:underline">Tether</a> — verified creator metrics</p>
          <a href="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700">
            Create your verified profile →
          </a>
        </div>

      </main>
    </div>
  );
}
