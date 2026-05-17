import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { fmt, timeAgo } from "@/lib/utils";
import { Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY, SnapshotData, InstagramSnapshotData, InstagramAccountInsights } from "@/lib/api";
import {
  IconYoutube, IconInstagram, IconExternal, IconShield,
  IconUsers, IconEye, IconVideo, IconTrendUp,
} from "@/components/ui/Icons";
import { ShareButton } from "./_components/ShareButton";
import { VideoList } from "./_components/VideoList";
import { TrackView } from "./_components/TrackView";

export const revalidate = 300;

// ── Server-side data fetch ─────────────────────────────────────────────────────

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://statvora.in";

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

// ── Handle decoding ────────────────────────────────────────────────────────────
// URL: /@mkbhd  →  params.handle = "@mkbhd" (Next.js decodes for us)
// But some CDNs may pass "%40mkbhd", so we always decodeURIComponent first.

function resolveHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  return decoded.slice(1); // strip "@" → bare username
}

// ── SEO metadata ───────────────────────────────────────────────────────────────

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
  const subCount = ytChannel?.subscribers;
  const category = profile.category ? `${profile.category} creator` : "creator";

  const ogTitle = `${name} — Verified ${category} profile on Statvora`;

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
    openGraph: {
      type: "profile",
      siteName: "Statvora",
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

// ── Chart helpers ──────────────────────────────────────────────────────────────

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

const stageLabels: Record<string, string> = {
  just_starting: "Just starting out",
  growing:       "Growing fast",
  established:   "Established creator",
  pro:           "Pro creator",
};

// ── YouTubeSection ─────────────────────────────────────────────────────────────

function YouTubeSection({ ytPlatform, ytData, analytics, mv, hasAnyVisible }: {
  ytPlatform: PlatformInfo;
  ytData: SnapshotData;
  analytics: ReturnType<typeof computeAnalytics>;
  mv: MetricVisibility;
  hasAnyVisible: boolean;
}) {
  return (
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

      {/* Post activity */}
      {mv.recent_videos && analytics && (
        <VideoList videos={analytics.withMetrics} totalCount={ytData.videos.length} />
      )}
    </div>
  );
}

// ── InstagramSection ───────────────────────────────────────────────────────────

// ── Instagram audience helpers ─────────────────────────────────────────────────

function parseGenderAge(raw: Record<string, number>) {
  let male = 0; let female = 0;
  const brackets: { label: string; pct: number }[] = [];
  for (const [key, val] of Object.entries(raw)) {
    const pct = val <= 1 ? Math.round(val * 100) : Math.round(val);
    if (key.startsWith("M.")) male += pct;
    else if (key.startsWith("F.")) female += pct;
    brackets.push({ label: key.replace("M.", "M ").replace("F.", "F "), pct });
  }
  brackets.sort((a, b) => b.pct - a.pct);
  return { male, female, brackets: brackets.slice(0, 6) };
}

function parseTopCountries(raw: Record<string, number>) {
  return Object.entries(raw)
    .map(([code, val]) => ({ code, pct: val <= 1 ? Math.round(val * 100) : Math.round(val) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5);
}

function parseOnlineHours(raw: Record<string, number>) {
  const max = Math.max(...Object.values(raw), 1);
  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
    count: raw[String(h)] ?? 0,
    pct:   Math.round(((raw[String(h)] ?? 0) / max) * 100),
  }));
}

function AudienceSection({ insights }: { insights: InstagramAccountInsights }) {
  const hasGenderAge  = !!insights.audience_gender_age && Object.keys(insights.audience_gender_age).length > 0;
  const hasCountry    = !!insights.audience_country    && Object.keys(insights.audience_country).length > 0;
  const hasOnline     = !!insights.online_followers    && Object.keys(insights.online_followers).length > 0;

  if (!hasGenderAge && !hasCountry && !hasOnline) return null;

  const ga      = hasGenderAge ? parseGenderAge(insights.audience_gender_age!)   : null;
  const countries = hasCountry ? parseTopCountries(insights.audience_country!)   : null;
  const hours   = hasOnline    ? parseOnlineHours(insights.online_followers!)     : null;
  const peakHour = hours ? hours.reduce((best, h) => h.count > best.count ? h : best, hours[0]) : null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Audience Insights</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gender / Age */}
        {ga && (
          <div className="bg-white/60 rounded-xl p-4 border border-white/80 space-y-3">
            <p className="text-xs font-bold text-gray-700">Gender Split</p>
            {/* Gender bar */}
            <div className="flex rounded-full overflow-hidden h-3">
              <div className="bg-blue-400 transition-all" style={{ width: `${ga.male}%` }} title={`Male ${ga.male}%`} />
              <div className="bg-pink-400 flex-1" title={`Female ${ga.female}%`} />
            </div>
            <div className="flex gap-4 text-[11px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Male {ga.male}%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />Female {ga.female}%</span>
            </div>
            {/* Top age brackets */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Top Age Brackets</p>
              {ga.brackets.map(b => (
                <div key={b.label} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-14 shrink-0">{b.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                      style={{ width: `${Math.min(b.pct * 2, 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">{b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Countries */}
        {countries && (
          <div className="bg-white/60 rounded-xl p-4 border border-white/80 space-y-2">
            <p className="text-xs font-bold text-gray-700">Top Countries</p>
            {countries.map(c => (
              <div key={c.code} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 w-7 shrink-0 font-mono">{c.code}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400"
                    style={{ width: `${Math.min(c.pct * 1.5, 100)}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">{c.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Best time to post — 24h heatmap */}
      {hours && peakHour && (
        <div className="bg-white/60 rounded-xl p-4 border border-white/80">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700">Best Time to Post</p>
            <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
              Peak: {peakHour.label} UTC
            </span>
          </div>
          <div className="flex items-end gap-0.5 h-10">
            {hours.map(h => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${h.label}: ${fmt(h.count)} followers online`}>
                <div
                  className={`w-full rounded-sm transition-all ${h.hour === peakHour.hour ? "bg-purple-500" : "bg-purple-200"}`}
                  style={{ height: `${Math.max(h.pct, 4)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InstagramSection({ igData }: { igData: InstagramSnapshotData }) {
  const insights = igData.account_insights;
  const postsWithInsights = igData.posts.filter(p => p.reach !== undefined);
  const hasPostInsights = postsWithInsights.length > 0;
  const avgReach            = hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.reach ?? 0), 0)              / postsWithInsights.length) : 0;
  const avgImpressions      = hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.impressions ?? 0), 0)        / postsWithInsights.length) : 0;
  const avgTotalInteractions= hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.total_interactions ?? 0), 0) / postsWithInsights.length) : 0;
  const totalSaved          = hasPostInsights ? igData.posts.reduce((s, p) => s + (p.saved ?? 0), 0)          : 0;
  const totalShares         = hasPostInsights ? igData.posts.reduce((s, p) => s + (p.shares ?? 0), 0)         : 0;
  const totalFollows        = hasPostInsights ? igData.posts.reduce((s, p) => s + (p.follows ?? 0), 0)        : 0;
  const totalProfileVisits  = hasPostInsights ? igData.posts.reduce((s, p) => s + (p.profile_visits ?? 0), 0) : 0;

  const hasAccountInsights = insights && (
    insights.website_clicks !== undefined ||
    insights.profile_views  !== undefined ||
    insights.account_reach  !== undefined
  );

  return (
    <div className="space-y-4">
      {/* Platform header */}
      <div className="bg-white rounded-2xl px-5 py-4 border border-gray-100 shadow-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <IconInstagram size={17} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">@{igData.account.username}</p>
            <p className="text-xs text-gray-400">{igData.account.name}</p>
          </div>
        </div>
        <a href={`https://instagram.com/${igData.account.username}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
          <IconExternal size={11} /> View on Instagram
        </a>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={IconUsers} label="Followers"   value={fmt(igData.account.followers_count)} bg="bg-[#fdf0f6]" iconColor="text-pink-500" />
        <MetricCard icon={IconVideo} label="Total Posts" value={fmt(igData.account.media_count)}     bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
      </div>

      {/* Account-level insights (last 7 days) */}
      {hasAccountInsights && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Last 7 Days</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {insights!.account_reach        !== undefined && <InsightCard label="Account Reach"    value={fmt(insights!.account_reach!)}       sub="unique accounts" />}
            {insights!.account_impressions  !== undefined && <InsightCard label="Impressions"      value={fmt(insights!.account_impressions!)} sub="total content views" />}
            {insights!.profile_views        !== undefined && <InsightCard label="Profile Visits"   value={fmt(insights!.profile_views!)}       sub="profile page visits" />}
            {insights!.website_clicks       !== undefined && <InsightCard label="Website Clicks"   value={fmt(insights!.website_clicks!)}      sub="link-in-bio taps" />}
          </div>
        </div>
      )}

      {/* Audience demographics */}
      {insights && <AudienceSection insights={insights} />}

      {/* Per-post aggregate insights */}
      {hasPostInsights && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Post Performance (Recent {postsWithInsights.length} posts)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InsightCard label="Avg Reach"         value={fmt(avgReach)}             sub="per post" />
            <InsightCard label="Avg Impressions"   value={fmt(avgImpressions)}       sub="per post" />
            <InsightCard label="Avg Interactions"  value={fmt(avgTotalInteractions)} sub="likes+comments+saves+shares" />
            <InsightCard label="Total Saves"       value={fmt(totalSaved)}           sub="across recent posts" />
            <InsightCard label="Total Shares"      value={fmt(totalShares)}          sub="across recent posts" />
            {totalFollows       > 0 && <InsightCard label="New Follows"     value={fmt(totalFollows)}       sub="from recent posts" />}
            {totalProfileVisits > 0 && <InsightCard label="Profile Visits"  value={fmt(totalProfileVisits)} sub="from recent posts" />}
          </div>
        </div>
      )}

      {/* Recent posts grid */}
      {igData.posts.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Posts</p>
          <div className="grid grid-cols-3 gap-2">
            {igData.posts.slice(0, 9).map(post => {
              const thumb = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
              return (
                <div key={post.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                  {thumb
                    ? <img src={thumb} alt={post.caption ?? "Post"} className="w-full h-full object-cover" loading="lazy" />
                    : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                        <IconInstagram size={18} className="text-pink-300" />
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 p-1.5 text-white text-[10px] font-semibold">
                    <span>♥ {fmt(post.like_count)}</span>
                    <span>💬 {fmt(post.comments_count)}</span>
                    {post.total_interactions !== undefined && <span>⚡ {fmt(post.total_interactions)}</span>}
                    {post.reach             !== undefined && <span>👁 {fmt(post.reach)}</span>}
                    {post.impressions       !== undefined && <span>📊 {fmt(post.impressions)}</span>}
                    {post.video_views       !== undefined && <span>▶ {fmt(post.video_views)}</span>}
                    {post.saved             !== undefined && <span>🔖 {fmt(post.saved)}</span>}
                    {post.shares            !== undefined && <span>↗ {fmt(post.shares)}</span>}
                    {post.follows           !== undefined && <span>➕ {fmt(post.follows)}</span>}
                    {post.profile_visits    !== undefined && <span>👤 {fmt(post.profile_visits)}</span>}
                  </div>
                  {post.media_type === "VIDEO" && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">▶</div>
                  )}
                  {post.media_type === "CAROUSEL_ALBUM" && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">⊞</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function CreatorPublicProfile(
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  // Decode "@mkbhd" from the URL segment (handles both "@" and "%40" variants)
  const username = resolveHandle(handle);

  // If this path doesn't start with @ it's not a profile route — let Next.js 404
  if (!username) return notFound();

  const data = await getProfile(username);

  // Profile not found in DB
  if (!data) return notFound();

  const { profile, platforms, snapshots } = data;

  // ── Type guard: business profiles live at /b/@username ─────────────────────
  if (profile.user_type === "business") {
    redirect(`/b/@${username}`);
  }

  const mv: MetricVisibility = (profile.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;
  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const igPlatform = platforms.find(p => p.platform === "instagram") ?? null;
  const ytSnap = snapshots["youtube"];
  const igSnap = snapshots["instagram"];
  const ytData: SnapshotData | null = ytSnap?.data as unknown as SnapshotData ?? null;
  const igData: InstagramSnapshotData | null = igSnap?.data as unknown as InstagramSnapshotData ?? null;
  const capturedAt = ytSnap?.captured_at ?? igSnap?.captured_at ?? null;
  const analytics = ytData ? computeAnalytics(ytData) : null;
  const hasAnyVisible = mv.subscribers || mv.total_views || mv.video_count || mv.avg_views || mv.view_chart || mv.recent_videos;
  const initials = (profile.full_name?.[0] ?? profile.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <img src="/brand/logo-icon.svg" width={28} height={28} alt="Statvora" className="rounded-lg" />
            <span className="text-sm font-bold text-gray-800">Statvora</span>
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
                {igPlatform && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pink-50 text-pink-600 border border-pink-100">
                    <IconInstagram size={10} /> Instagram
                  </span>
                )}
              </div>
            </div>
            <a href="/login" className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              Join Statvora
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
        {!ytPlatform && !igPlatform && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center">
            <p className="text-sm font-medium text-gray-500 mb-1">No platforms connected yet</p>
            <p className="text-xs text-gray-400">This creator hasn&apos;t linked any platform accounts.</p>
          </div>
        )}

        {/* YouTube: connected but no snapshot */}
        {ytPlatform && !ytData && !igData && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <IconYoutube size={18} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-500">YouTube connected</p>
            <p className="text-xs text-gray-400">Metrics will appear here after the creator refreshes their dashboard.</p>
          </div>
        )}

        {/* Instagram: connected but no snapshot yet */}
        {igPlatform && !igData && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <IconInstagram size={17} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">@{igPlatform.metadata?.username as string ?? igPlatform.platform_username}</p>
                <p className="text-xs text-gray-400">Instagram</p>
              </div>
              <a href={`https://instagram.com/${igPlatform.metadata?.username as string ?? igPlatform.platform_username}`}
                target="_blank" rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600">
                <IconExternal size={11} /> View on Instagram
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(igPlatform.metadata?.followers_count as number) > 0 && (
                <MetricCard icon={IconUsers} label="Followers"
                  value={fmt(igPlatform.metadata?.followers_count as number)}
                  bg="bg-[#fdf0f6]" iconColor="text-pink-500" />
              )}
              {(igPlatform.metadata?.media_count as number) > 0 && (
                <MetricCard icon={IconVideo} label="Total Posts"
                  value={fmt(igPlatform.metadata?.media_count as number)}
                  bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Full metrics will appear after the creator visits their dashboard.
            </p>
          </div>
        )}

        {/* ── Platform content — always stacked, no tabs ─────────────────── */}
        {ytPlatform && ytData && (
          <>
            {/* YouTube divider (only shown when Instagram is also present) */}
            {igPlatform && (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100">
                  <IconYoutube size={12} className="text-red-500" />
                  <span className="text-xs font-bold text-red-600">YouTube</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-red-200 to-transparent" />
              </div>
            )}
            <YouTubeSection
              ytPlatform={ytPlatform}
              ytData={ytData}
              analytics={analytics}
              mv={mv}
              hasAnyVisible={hasAnyVisible}
            />
          </>
        )}

        {igPlatform && igData && (
          <>
            {/* Instagram divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-pink-100">
                <IconInstagram size={12} className="text-pink-500" />
                <span className="text-xs font-bold text-pink-600">Instagram</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-pink-200 to-transparent" />
            </div>
            <InstagramSection igData={igData} />
          </>
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
          <p className="text-xs text-gray-400 mb-3">Powered by <a href="/" className="text-brand-600 font-medium hover:underline">Statvora</a> — verified creator metrics</p>
          <a href="/signup" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700">
            Create your verified profile →
          </a>
        </div>

      </main>
    </div>
  );
}
