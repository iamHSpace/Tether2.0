"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { api, YouTubeStatsResponse, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt, timeAgo, cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconUsers, IconEye, IconVideo, IconTrendUp, IconYoutube,
  IconRefresh, IconExternal, IconThumbUp, IconChat,
  IconCopy, IconCheck, IconBell, IconAlert,
} from "@/components/ui/Icons";

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!enabled)}
      className={cn("relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        enabled ? "bg-brand-600" : "bg-gray-200")} aria-pressed={enabled}>
      <span className={cn("pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
        enabled ? "translate-x-4" : "translate-x-0")} />
    </button>
  );
}

// ── Bezier area chart ──────────────────────────────────────────────────────────

function AreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-gray-300">Not enough data</div>;
  const W = 500; const H = 96;
  const max = Math.max(...data); const min = Math.min(...data); const range = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [(i / (data.length - 1)) * W, H - 10 - ((v - min) / range) * (H - 20)]);
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
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Bar chart ──────────────────────────────────────────────────────────────────

function BarChart({ data, color = "#7c3aed", showValues = false }: {
  data: { label: string; value: number; sublabel?: string }[];
  color?: string;
  showValues?: boolean;
}) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value)) || 1;
  const H = 80; const labelH = 28; const gap = 4;
  const barW = Math.max(8, (300 - gap * (data.length - 1)) / data.length);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${data.length * (barW + gap)} ${H + labelH}`} width="100%"
        style={{ minWidth: data.length * 28 }} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * H);
          const x = i * (barW + gap);
          const y = H - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} opacity={d.value === max ? "1" : "0.55"} />
              {showValues && d.value > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="7" fill="#6b7280">{fmt(d.value)}</text>
              )}
              <text x={x + barW / 2} y={H + 12} textAnchor="middle" fontSize="8" fill="#9ca3af">{d.label}</text>
              {d.sublabel && (
                <text x={x + barW / 2} y={H + 22} textAnchor="middle" fontSize="7" fill="#d1d5db">{d.sublabel}</text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Error alert ────────────────────────────────────────────────────────────────

function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 border border-red-100">
      <IconAlert size={16} className="text-red-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-red-700">Something went wrong</p>
        <p className="text-xs text-red-500 mt-0.5 break-words">{message}</p>
      </div>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-100">
          Retry
        </button>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse bg-gray-200/70 rounded-xl", className)} />;
}
function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card space-y-3">
      <Skeleton className="w-10 h-10 rounded-xl" /><Skeleton className="h-7 w-20 rounded-lg" /><Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, bg, iconColor }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; bg: string; iconColor: string;
}) {
  return (
    <div className={cn("rounded-2xl p-4 border border-white/60 shadow-card", bg)}>
      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 bg-white/50", iconColor)}>
        <Icon size={15} />
      </div>
      <p className="text-xl font-bold text-gray-900 tracking-tight leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs font-medium text-gray-500 mt-1">{label}</p>
    </div>
  );
}

// ── Insight card ───────────────────────────────────────────────────────────────

function InsightCard({ label, value, sub, color = "text-gray-900" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
      <p className={cn("text-xl font-bold leading-none", color)}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      <p className="text-xs text-gray-500 font-medium mt-1.5">{label}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Metric defs ────────────────────────────────────────────────────────────────

const METRIC_DEFS: { key: keyof MetricVisibility; label: string; desc: string; Icon: React.ElementType }[] = [
  { key: "subscribers",   label: "Subscribers",       desc: "YouTube subscriber count",           Icon: IconUsers   },
  { key: "total_views",   label: "Total Views",        desc: "Lifetime channel view count",        Icon: IconEye     },
  { key: "video_count",   label: "Videos Published",   desc: "Total number of uploaded videos",    Icon: IconVideo   },
  { key: "avg_views",     label: "Avg Views / Video",  desc: "Average views across all videos",    Icon: IconTrendUp },
  { key: "view_chart",    label: "Performance Chart",  desc: "Views chart from recent uploads",    Icon: IconEye     },
  { key: "recent_videos", label: "Recent Videos",      desc: "List of most recent uploads",        Icon: IconVideo   },
];

// ── Sort icon ──────────────────────────────────────────────────────────────────

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  return (
    <span className={cn("ml-1 text-[10px]", active ? "text-brand-600" : "text-gray-300")}>
      {active ? (dir === "desc" ? "↓" : "↑") : "↕"}
    </span>
  );
}

// ── Analytics helpers ──────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function detectSeries(videos: YouTubeStatsResponse["videos"]): { name: string; videos: YouTubeStatsResponse["videos"] }[] {
  const groups: Record<string, YouTubeStatsResponse["videos"]> = {};
  for (const v of videos) {
    if (!v.title) continue;
    const words = v.title.toLowerCase().split(/\s+/);
    for (let len = 2; len <= Math.min(4, words.length - 1); len++) {
      const key = words.slice(0, len).join(" ");
      if (!groups[key]) groups[key] = [];
      groups[key].push(v);
    }
  }
  return Object.entries(groups)
    .filter(([, vids]) => vids.length >= 2)
    .map(([name, vids]) => ({
      name: name.replace(/\b\w/g, c => c.toUpperCase()),
      videos: vids,
    }))
    .sort((a, b) => b.videos.length - a.videos.length)
    .slice(0, 4);
}

// ── Page ───────────────────────────────────────────────────────────────────────

interface DashboardProfile { username: string | null; email: string; metricVisibility: MetricVisibility; }

type SortKey = "views" | "engagement" | "interactionRate" | "viewContrib" | "commentDensity" | "titleLength";

export default function DashboardPage() {
  const [profile, setProfile]         = useState<DashboardProfile | null>(null);
  const [ytData, setYtData]           = useState<YouTubeStatsResponse | null>(null);
  const [ytError, setYtError]         = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [copied, setCopied]           = useState(false);
  const [metricVisibility, setMetricVisibility] = useState<MetricVisibility>(DEFAULT_METRIC_VISIBILITY);
  const [savingMetrics, setSavingMetrics]       = useState(false);
  const [metricsSaved, setMetricsSaved]         = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [showAllVideos, setShowAllVideos]       = useState(false);
  const [videoSort, setVideoSort]               = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "views", dir: "desc" });
  const [profileViews, setProfileViews]         = useState<{ this_week: number; last_week: number } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("youtube_connected") || params.has("youtube_error")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    // Handle Google OAuth role assignment — if role was stored before OAuth
    const intendedType = localStorage.getItem("tether_intended_user_type");
    if (intendedType && !user.user_metadata?.user_type) {
      await supabase.auth.updateUser({ data: { user_type: intendedType } });
      localStorage.removeItem("tether_intended_user_type");
      if (intendedType === "business") { window.location.href = "/discover"; return; }
    }

    const [profileResult, ytResult] = await Promise.allSettled([
      api.profile.get(),
      api.youtube.stats(),
    ]);

    if (profileResult.status === "fulfilled") {
      const { profile: prof, email } = profileResult.value;
      // Fallback redirect for existing business users without JWT metadata
      if (prof.user_type === "business") { window.location.href = "/discover"; return; }
      const mv = prof.metric_visibility ?? DEFAULT_METRIC_VISIBILITY;
      setProfile({ username: prof.username, email: email ?? user.email ?? "", metricVisibility: mv });
      setMetricVisibility(mv);
    } else {
      setProfile({ username: null, email: user.email ?? "", metricVisibility: DEFAULT_METRIC_VISIBILITY });
    }

    if (ytResult.status === "fulfilled") {
      setYtData(ytResult.value);
      setYtConnected(true);
      setYtError(null);
    } else {
      const msg = ytResult.reason instanceof Error ? ytResult.reason.message : String(ytResult.reason);
      setYtConnected(msg.toLowerCase().includes("not connected") || msg.toLowerCase().includes("no youtube") ? false : true);
      setYtError(msg);
    }

    setLoading(false);

    // Load profile views independently — non-blocking
    api.profile.views()
      .then(v => setProfileViews({ this_week: v.this_week, last_week: v.last_week }))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/c/${profile?.username ?? "me"}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function refreshMetrics() {
    setRefreshing(true); setYtError(null);
    try { setYtData(await api.youtube.stats()); }
    catch (err) { setYtError(err instanceof Error ? err.message : String(err)); }
    setRefreshing(false);
  }

  async function saveMetrics(vis: MetricVisibility) {
    setSavingMetrics(true);
    try { await api.profile.updateMetrics(vis); setMetricsSaved(true); setTimeout(() => setMetricsSaved(false), 2500); }
    catch { /* non-fatal */ }
    setSavingMetrics(false);
  }

  function toggleMetric(key: keyof MetricVisibility) {
    const updated = { ...metricVisibility, [key]: !metricVisibility[key] };
    setMetricVisibility(updated); saveMetrics(updated);
  }

  function toggleSort(key: SortKey) {
    setVideoSort(s => s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" });
  }

  // ── Derived analytics ────────────────────────────────────────────────────────

  const analytics = useMemo(() => {
    if (!ytData || !ytData.videos.length) return null;

    const videos = ytData.videos;
    const ch = ytData.channel;

    const sorted = [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    const oldest = sorted[0];
    const newest = sorted[sorted.length - 1];
    const accountAgeDays = Math.round(
      (new Date(newest.publishedAt).getTime() - new Date(oldest.publishedAt).getTime()) / 86400000
    );
    const uploadVelocity = sorted.length > 1 ? accountAgeDays / (sorted.length - 1) : 0;

    const knownViews = videos.reduce((s, v) => s + v.views, 0);
    const ghostViews = Math.max(0, ch.totalViews - knownViews);
    const subToViewRatio = ch.subscribers > 0 ? ch.totalViews / ch.subscribers : 0;
    const avgEngagement = videos.reduce((s, v) => s + (v.likes * 2 + v.comments), 0) / videos.length;

    // Per-video computed metrics
    const withMetrics = videos.map(v => ({
      ...v,
      engagementScore: v.likes * 2 + v.comments,
      interactionRate: v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0,
      viewContrib: ch.totalViews > 0 ? (v.views / ch.totalViews) * 100 : 0,
      commentDensity: v.views > 0 ? (v.comments / v.views) * 100 : 0,
      titleLength: v.title?.length ?? 0,
    }));

    // Weekday performance
    const weekdayBuckets = WEEKDAYS.map((day, i) => {
      const dayVids = videos.filter(v => new Date(v.publishedAt).getDay() === i);
      return {
        label: day,
        value: dayVids.length > 0 ? Math.round(dayVids.reduce((s, v) => s + v.views, 0) / dayVids.length) : 0,
        sublabel: `${dayVids.length}v`,
      };
    });

    // Monthly uploads
    const monthCounts: Record<string, number> = {};
    for (const v of videos) {
      const key = new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      monthCounts[key] = (monthCounts[key] || 0) + 1;
    }
    const monthlyUploads = Object.entries(monthCounts).map(([label, value]) => ({ label, value }));

    // Recency decay: last 6 sorted newest→oldest
    const recentDecay = [...sorted].reverse().slice(0, 6).map(v => ({ label: "", value: v.views }));

    // Title length buckets
    const titleBuckets = [
      { label: "Short\n<30", vids: withMetrics.filter(v => v.titleLength < 30) },
      { label: "Med\n30-60", vids: withMetrics.filter(v => v.titleLength >= 30 && v.titleLength <= 60) },
      { label: "Long\n>60",  vids: withMetrics.filter(v => v.titleLength > 60) },
    ].map(b => ({
      label: b.label.split("\n")[0],
      sublabel: b.label.split("\n")[1],
      value: b.vids.length > 0 ? Math.round(b.vids.reduce((s, v) => s + v.engagementScore, 0) / b.vids.length) : 0,
    }));

    // Series detection
    const series = detectSeries(videos);

    return {
      accountAgeDays, uploadVelocity, ghostViews, subToViewRatio, avgEngagement,
      knownViews, withMetrics, weekdayBuckets, monthlyUploads, recentDecay, titleBuckets, series,
    };
  }, [ytData]);

  // Sorted video table
  const sortedVideos = useMemo(() => {
    if (!analytics) return [];
    return [...analytics.withMetrics].sort((a, b) => {
      const v = { views: [a.views, b.views], engagement: [a.engagementScore, b.engagementScore],
        interactionRate: [a.interactionRate, b.interactionRate], viewContrib: [a.viewContrib, b.viewContrib],
        commentDensity: [a.commentDensity, b.commentDensity], titleLength: [a.titleLength, b.titleLength] };
      const [av, bv] = v[videoSort.key];
      return videoSort.dir === "desc" ? bv - av : av - bv;
    });
  }, [analytics, videoSort]);

  const visibleVideos = showAllVideos ? sortedVideos : sortedVideos.slice(0, 5);

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={profile?.email} username={profile?.username ?? undefined} />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-gray-900">
              {loading ? "Loading…" : `Welcome back${profile?.username ? `, @${profile.username}` : ""}!`}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Creator analytics dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            {profileViews !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-brand-100 bg-brand-50 text-brand-700 shadow-sm">
                <IconEye size={12} />
                <span>
                  <strong>{profileViews.this_week}</strong> view{profileViews.this_week !== 1 ? "s" : ""} this week
                </span>
                {profileViews.last_week > 0 && (
                  <span className={`text-[10px] font-semibold ml-0.5 ${profileViews.this_week >= profileViews.last_week ? "text-green-600" : "text-gray-400"}`}>
                    {profileViews.this_week >= profileViews.last_week
                      ? `↑ vs ${profileViews.last_week} last week`
                      : `↓ vs ${profileViews.last_week} last week`}
                  </span>
                )}
              </div>
            )}
            {profile?.username && (
              <>
                <a href={`/c/${profile.username}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm">
                  <IconExternal size={12} /> View profile
                </a>
                <button onClick={copyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm">
                  {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
                  {copied ? "Copied!" : "Copy profile link"}
                </button>
              </>
            )}
            <button className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm">
              <IconBell size={14} className="text-gray-400" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-7 max-w-7xl">

          {/* ── Platform Connection ────────────────────────────────────────── */}
          <section>
            <SectionHeader title="Platform Connection" />
            <div className="max-w-lg">
              {loading ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : ytData ? (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ytData.channel.thumbnail
                      ? <img src={ytData.channel.thumbnail} alt={ytData.channel.name} width={40} height={40} className="rounded-full ring-2 ring-red-100" />
                      : <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><IconYoutube size={20} className="text-white" /></div>
                    }
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{ytData.channel.name}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Live</span>
                      </div>
                      {ytData.channel.handle && <p className="text-xs text-gray-400">{ytData.channel.handle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={refreshMetrics} disabled={refreshing}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50">
                      <IconRefresh size={11} className={refreshing ? "animate-spin" : ""} />
                      {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                    <a href={`https://youtube.com/channel/${ytData.channel.id}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <IconExternal size={11} className="text-gray-400" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border-2 border-dashed border-red-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                      <IconYoutube size={18} className="text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">YouTube</p>
                      <p className="text-xs text-gray-400">Not connected</p>
                    </div>
                  </div>
                  <button onClick={() => api.youtube.connect()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700">
                    <IconYoutube size={12} className="text-white" /> Connect
                  </button>
                </div>
              )}
            </div>
          </section>

          {ytError && <ErrorAlert message={ytError} onRetry={refreshMetrics} />}

          {/* ── No YouTube state ───────────────────────────────────────────── */}
          {!loading && ytConnected === false && !ytData && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-card text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
                <IconYoutube size={24} className="text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Connect YouTube to see analytics</h3>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">Link your channel to start showing verified metrics on your public profile.</p>
              <button onClick={() => api.youtube.connect()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700">
                <IconYoutube size={15} className="text-white" /> Connect YouTube
              </button>
            </div>
          )}

          {ytData && analytics && (
            <>
              {/* ── Channel Overview ─────────────────────────────────────────── */}
              <section>
                <SectionHeader title="Channel Overview" subtitle="Core stats pulled directly from YouTube Data API." />
                {loading ? (
                  <div className="grid grid-cols-5 gap-3"><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton /></div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard label="Subscribers"     value={fmt(ytData.channel.subscribers)}  icon={IconUsers}   bg="bg-[#e8f5f0]" iconColor="text-emerald-600" />
                    <StatCard label="Total Views"     value={fmt(ytData.channel.totalViews)}   icon={IconEye}     bg="bg-[#fef9ec]" iconColor="text-amber-500"
                      sub={`${fmt(analytics.ghostViews)} from unlisted`} />
                    <StatCard label="Videos Uploaded" value={fmt(ytData.channel.videoCount)}   icon={IconVideo}   bg="bg-[#f0f0fe]" iconColor="text-brand-600" />
                    <StatCard label="Avg Views / Video" value={fmt(Math.round(ytData.channel.totalViews / Math.max(ytData.channel.videoCount, 1)))}
                      icon={IconTrendUp} bg="bg-[#fdf0f3]" iconColor="text-rose-500" />
                    <StatCard label="Content Span"
                      value={analytics.accountAgeDays > 0 ? `${analytics.accountAgeDays}d` : "—"}
                      sub={analytics.accountAgeDays > 0 ? `${Math.round(analytics.uploadVelocity * 10) / 10}d avg between uploads` : undefined}
                      icon={IconRefresh} bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
                  </div>
                )}
              </section>

              {/* ── Derived Insights ─────────────────────────────────────────── */}
              <section>
                <SectionHeader title="Derived Insights" subtitle="Metrics computed from your channel and video data." />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <InsightCard
                    label="Sub-to-View Ratio"
                    value={`${Math.round(analytics.subToViewRatio * 10) / 10}×`}
                    sub="views per subscriber (lifetime)"
                    color={analytics.subToViewRatio >= 50 ? "text-emerald-600" : "text-gray-900"}
                  />
                  <InsightCard
                    label="Ghost Views"
                    value={fmt(analytics.ghostViews)}
                    sub={`${Math.round((analytics.ghostViews / Math.max(ytData.channel.totalViews, 1)) * 100)}% from videos not in list`}
                  />
                  <InsightCard
                    label="Upload Velocity"
                    value={analytics.uploadVelocity > 0 ? `${Math.round(analytics.uploadVelocity * 10) / 10}d` : "—"}
                    sub="avg days between uploads"
                    color={analytics.uploadVelocity > 0 && analytics.uploadVelocity <= 7 ? "text-emerald-600" : "text-gray-900"}
                  />
                  <InsightCard
                    label="Avg Engagement Score"
                    value={fmt(Math.round(analytics.avgEngagement))}
                    sub="(likes × 2) + comments per video"
                  />
                </div>
              </section>

              {/* ── Charts ───────────────────────────────────────────────────── */}
              <section>
                <SectionHeader title="Performance Charts" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Views sparkline */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card lg:col-span-2">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Views by Video</h3>
                        <p className="text-xs text-gray-400">Oldest → newest (all {ytData.videos.length} videos)</p>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">
                        Peak: {fmt(Math.max(...ytData.videos.map(v => v.views)))}
                      </span>
                    </div>
                    <AreaChart data={[...ytData.videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).map(v => v.views)} color="#7c3aed" gradientId="views-all" />
                    <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
                      <span>Oldest</span><span>Latest</span>
                    </div>
                  </div>

                  {/* Recency decay */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-gray-900">Recency Decay</h3>
                      <p className="text-xs text-gray-400">Views on last 6 uploads (newest first)</p>
                    </div>
                    <AreaChart data={analytics.recentDecay.map(d => d.value)} color="#f59e0b" gradientId="decay" />
                    <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
                      <span>Latest</span><span>-6th</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  {/* Publishing momentum */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Publishing Momentum</h3>
                    <p className="text-xs text-gray-400 mb-3">Uploads per month</p>
                    <BarChart data={analytics.monthlyUploads} color="#7c3aed" showValues />
                  </div>

                  {/* Weekday performance */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Best Day to Post</h3>
                    <p className="text-xs text-gray-400 mb-3">Avg views by publish weekday</p>
                    <BarChart data={analytics.weekdayBuckets} color="#10b981" />
                  </div>

                  {/* Title length vs engagement */}
                  <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                    <h3 className="text-sm font-bold text-gray-900 mb-1">Title Length vs Engagement</h3>
                    <p className="text-xs text-gray-400 mb-3">Avg engagement score by title length</p>
                    <BarChart data={analytics.titleBuckets} color="#f59e0b" showValues />
                  </div>
                </div>
              </section>

              {/* ── Series Performance ────────────────────────────────────────── */}
              {analytics.series.length > 0 && (
                <section>
                  <SectionHeader title="Content Series" subtitle="Videos grouped by common title prefix." />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {analytics.series.map(s => {
                      const avgViews = Math.round(s.videos.reduce((sum, v) => sum + v.views, 0) / s.videos.length);
                      const avgEng   = Math.round(s.videos.reduce((sum, v) => sum + v.likes * 2 + v.comments, 0) / s.videos.length);
                      return (
                        <div key={s.name} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card">
                          <p className="text-xs font-bold text-gray-900 truncate">{s.name}…</p>
                          <p className="text-[10px] text-gray-400 mb-2">{s.videos.length} videos</p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Avg views</span>
                              <span className="font-semibold text-gray-800">{fmt(avgViews)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Avg engagement</span>
                              <span className="font-semibold text-gray-800">{fmt(avgEng)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* ── Post Activity Table ───────────────────────────────────────── */}
              <section>
                <SectionHeader title="Post Activity" subtitle="All videos with computed performance metrics. Click column headers to sort." />
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_32px] gap-0 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
                    {[
                      { label: "Video", key: null },
                      { label: "Views", key: "views" as SortKey },
                      { label: "Engagement", key: "engagement" as SortKey },
                      { label: "Interact %", key: "interactionRate" as SortKey },
                      { label: "View %", key: "viewContrib" as SortKey },
                      { label: "Cmt Density", key: "commentDensity" as SortKey },
                    ].map(col => (
                      <button key={col.label}
                        onClick={() => col.key && toggleSort(col.key)}
                        className={cn("text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider",
                          col.key && "hover:text-gray-600 cursor-pointer")}
                        disabled={!col.key}>
                        {col.label}
                        {col.key && <SortIcon active={videoSort.key === col.key} dir={videoSort.dir} />}
                      </button>
                    ))}
                    <div />
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-gray-50">
                    {visibleVideos.map(v => (
                      <div key={v.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_32px] gap-0 items-center px-4 py-3 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0 pr-3">
                          {v.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={v.thumbnail} alt={v.title ?? "Video"} width={64} height={38}
                              className="rounded-lg object-cover shrink-0 border border-gray-100" />
                          ) : (
                            <div className="w-16 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                              <IconVideo size={14} className="text-gray-300" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 line-clamp-1">{v.title || <span className="text-gray-300 italic">Untitled</span>}</p>
                            <p className="text-[10px] text-gray-400">{timeAgo(v.publishedAt)} · {v.titleLength}ch title</p>
                          </div>
                        </div>
                        <div className="text-xs font-semibold text-gray-800">{fmt(v.views)}</div>
                        <div className="text-xs">
                          <span className="font-semibold text-gray-800">{fmt(v.engagementScore)}</span>
                          <span className="text-gray-300 ml-1 text-[10px]">({fmt(v.likes)}L {fmt(v.comments)}C)</span>
                        </div>
                        <div className="text-xs font-semibold text-gray-800">{v.interactionRate.toFixed(2)}%</div>
                        <div className="text-xs font-semibold text-gray-800">{v.viewContrib.toFixed(1)}%</div>
                        <div className="text-xs font-semibold text-gray-800">{v.commentDensity.toFixed(2)}%</div>
                        <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                          <IconExternal size={10} className="text-gray-400" />
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Show more */}
                  {sortedVideos.length > 5 && (
                    <div className="px-4 py-3 border-t border-gray-50">
                      <button onClick={() => setShowAllVideos(v => !v)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                        {showAllVideos ? "Show less" : `Show all ${sortedVideos.length} videos`}
                      </button>
                    </div>
                  )}
                </div>

                {/* Table legend */}
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 px-1">
                  {[
                    ["Engagement", "(Likes × 2) + Comments"],
                    ["Interact %", "(Likes + Comments) / Views × 100"],
                    ["View %", "Video's share of total channel views"],
                    ["Cmt Density", "Comments / Views × 100"],
                  ].map(([k, v]) => (
                    <p key={k} className="text-[10px] text-gray-400">
                      <span className="font-semibold text-gray-500">{k}:</span> {v}
                    </p>
                  ))}
                </div>
              </section>

              {/* ── Metric Visibility ─────────────────────────────────────────── */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">Metric Visibility</h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Control what appears on{" "}
                      {profile?.username
                        ? <a href={`/c/${profile.username}`} target="_blank" className="text-brand-600 hover:underline">tether.so/c/{profile.username}</a>
                        : "your public profile"}.
                    </p>
                  </div>
                  {metricsSaved && <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><IconCheck size={12} /> Saved</span>}
                  {savingMetrics && !metricsSaved && <span className="text-xs text-gray-400">Saving…</span>}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-card divide-y divide-gray-50">
                  {METRIC_DEFS.map(({ key, label, desc, Icon }) => (
                    <div key={key} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                          <Icon size={14} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                      </div>
                      <Toggle enabled={metricVisibility[key]} onChange={() => toggleMetric(key)} />
                    </div>
                  ))}
                </div>
              </section>

            </>
          )}

        </div>
      </main>
    </div>
  );
}
