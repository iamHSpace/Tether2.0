"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { api, ApiError, YouTubeStatsResponse, InstagramStatsResponse, InstagramAccountInsights, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt, timeAgo, cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconUsers, IconEye, IconVideo, IconTrendUp, IconYoutube, IconInstagram,
  IconRefresh, IconExternal, IconThumbUp, IconChat,
  IconCopy, IconCheck, IconBell, IconAlert, IconBookmark, IconShare,
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

// ── Error helpers ──────────────────────────────────────────────────────────────

/** Translate low-level fetch/network errors into readable sentences. */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("network") ||
    msg.includes("ERR_CONNECTION") ||
    msg.includes("Load failed")           // Safari equivalent of "Failed to fetch"
  ) {
    return "Could not reach the server. Make sure the backend is running on port 3000.";
  }
  if (msg.includes("quota") || msg.includes("Quota")) {
    return "YouTube API quota exceeded. Stats will refresh automatically tomorrow.";
  }
  // Google OAuth errors
  if (msg === "access_denied") {
    return "Google blocked access. Make sure your Google account is added as a test user in Google Cloud Console → APIs & Services → OAuth consent screen → Test users.";
  }
  if (msg === "invalid_or_expired_state") {
    return "OAuth session expired. Please try connecting again.";
  }
  if (msg === "redirect_uri_mismatch") {
    return "OAuth redirect URI mismatch. Check that http://127.0.0.1:3000/api/oauth/youtube/callback is added in Google Cloud Console → Credentials.";
  }
  return msg;
}

// ── Error alert ────────────────────────────────────────────────────────────────

function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const isNetwork =
    message.includes("Could not reach") ||
    message.includes("connection");
  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-2xl border",
      isNetwork
        ? "bg-amber-50 border-amber-100"
        : "bg-red-50 border-red-100"
    )}>
      <IconAlert size={16} className={cn("shrink-0 mt-0.5", isNetwork ? "text-amber-500" : "text-red-500")} />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", isNetwork ? "text-amber-800" : "text-red-700")}>
          {isNetwork ? "Connection problem" : "Something went wrong"}
        </p>
        <p className={cn("text-xs mt-0.5 break-words", isNetwork ? "text-amber-600" : "text-red-500")}>
          {message}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            "shrink-0 text-xs font-medium px-2 py-1 rounded-lg",
            isNetwork
              ? "text-amber-700 hover:text-amber-900 hover:bg-amber-100"
              : "text-red-600 hover:text-red-800 hover:bg-red-100"
          )}
        >
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
  const [ytExpired, setYtExpired]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [copied, setCopied]           = useState(false);
  const [metricVisibility, setMetricVisibility] = useState<MetricVisibility>(DEFAULT_METRIC_VISIBILITY);
  const [savingMetrics, setSavingMetrics]       = useState(false);
  const [metricsSaved, setMetricsSaved]         = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [ytConnecting, setYtConnecting]         = useState(false);
  const [ytConnectError, setYtConnectError]     = useState<string | null>(null);
  const [igData, setIgData]                     = useState<InstagramStatsResponse | null>(null);
  const [igError, setIgError]                   = useState<string | null>(null);
  const [igExpired, setIgExpired]               = useState(false);
  const [igConnected, setIgConnected]           = useState<boolean | null>(null);
  const [igConnecting, setIgConnecting]         = useState(false);
  const [igConnectError, setIgConnectError]     = useState<string | null>(null);
  const [showAllVideos, setShowAllVideos]       = useState(false);
  const [videoSort, setVideoSort]               = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "views", dir: "desc" });
  const [profileViews, setProfileViews]         = useState<{ this_week: number; last_week: number } | null>(null);
  const [activeTab, setActiveTab]               = useState<"youtube" | "instagram">("youtube");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("youtube_connected") || params.has("youtube_error") ||
        params.has("instagram_connected") || params.has("instagram_error")) {
      const ytErr = params.get("youtube_error");
      if (ytErr) setYtConnectError(friendlyError(new Error(decodeURIComponent(ytErr))));
      const igErr = params.get("instagram_error");
      if (igErr) setIgConnectError(decodeURIComponent(igErr));
      // Switch to the relevant tab after OAuth redirect
      if (params.has("instagram_connected") || params.has("instagram_error")) {
        setActiveTab("instagram");
      }
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    // Handle Google OAuth role assignment — if role was stored before OAuth
    const intendedType = localStorage.getItem("statvora_intended_user_type");
    if (intendedType && !user.user_metadata?.user_type) {
      await supabase.auth.updateUser({ data: { user_type: intendedType } });
      localStorage.removeItem("statvora_intended_user_type");
      if (intendedType === "business") { window.location.href = "/discover"; return; }
    }

    const [profileResult, ytResult, igResult] = await Promise.allSettled([
      api.profile.get(),
      api.youtube.stats(),
      api.instagram.stats(),
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
      setYtExpired(false);
    } else {
      const err = ytResult.reason;
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 404) {
        setYtConnected(false);
        setYtExpired(false);
        setYtError(null);
      } else if (status === 401) {
        setYtConnected(false);
        setYtExpired(true);
        setYtError(null);
      } else if (status === 0) {
        setYtConnected(null);
        setYtExpired(false);
        setYtError(friendlyError(err));
      } else {
        setYtConnected(true);
        setYtExpired(false);
        setYtError(friendlyError(err));
      }
    }

    if (igResult.status === "fulfilled") {
      setIgData(igResult.value);
      setIgConnected(true);
      setIgError(null);
      setIgExpired(false);
    } else {
      const err = igResult.reason;
      const status = err instanceof ApiError ? err.status : 0;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 404 || msg.includes("not_connected")) {
        setIgConnected(false);
        setIgExpired(false);
        setIgError(null);
      } else if (status === 401 || msg.includes("token_expired")) {
        setIgConnected(false);
        setIgExpired(true);
        setIgError(null);
      } else if (status === 0) {
        setIgConnected(null);
        setIgExpired(false);
        setIgError(friendlyError(err));
      } else {
        setIgConnected(true);
        setIgExpired(false);
        setIgError(friendlyError(err));
      }
    }

    setLoading(false);

    // Auto-switch to Instagram tab if YouTube is not connected but Instagram is
    if (ytResult.status !== "fulfilled" && igResult.status === "fulfilled") {
      setActiveTab("instagram");
    }

    // Load profile views independently — non-blocking
    api.profile.views()
      .then(v => setProfileViews({ this_week: v.this_week, last_week: v.last_week }))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/@${profile?.username ?? "me"}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function refreshMetrics() {
    setRefreshing(true); setYtError(null); setYtExpired(false);
    try {
      setYtData(await api.youtube.stats());
      setYtConnected(true);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401) {
        setYtConnected(false);
        setYtExpired(true);
      } else if (status !== 404) {
        setYtError(friendlyError(err));
      }
    }
    setRefreshing(false);
  }

  async function connectYouTube() {
    setYtConnecting(true);
    setYtConnectError(null);
    try {
      await api.youtube.connect(); // redirects on success; never reaches the line below
    } catch (err) {
      setYtConnectError(friendlyError(err));
      setYtConnecting(false);
    }
  }

  async function connectInstagram() {
    setIgConnecting(true);
    setIgConnectError(null);
    try {
      await api.instagram.connect(); // redirects on success
    } catch (err) {
      setIgConnectError(err instanceof Error ? err.message : String(err));
      setIgConnecting(false);
    }
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
                <a href={`/@${profile.username}`} target="_blank" rel="noopener noreferrer"
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
            <SectionHeader title="Platform Connections" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {/* YouTube card */}
              {loading ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : ytData ? (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card flex items-center gap-3">
                  <div className="shrink-0">
                    {ytData.channel.thumbnail
                      ? <img src={ytData.channel.thumbnail} alt={ytData.channel.name} width={40} height={40} className="rounded-full ring-2 ring-red-100" />
                      : <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center"><IconYoutube size={20} className="text-white" /></div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{ytData.channel.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">✓ Live</span>
                      {ytData.channel.handle && <p className="text-xs text-gray-400 truncate">{ytData.channel.handle}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={refreshMetrics} disabled={refreshing}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50">
                      <IconRefresh size={11} className={refreshing ? "animate-spin" : ""} />
                      {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                    <a href={`https://youtube.com/channel/${ytData.channel.id}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 shrink-0">
                      <IconExternal size={11} className="text-gray-400" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className={`bg-white rounded-2xl p-4 border-2 border-dashed flex items-center justify-between ${ytExpired ? "border-amber-200" : "border-red-100"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${ytExpired ? "bg-amber-50 border-amber-100" : "bg-red-50 border-red-100"}`}>
                      <IconYoutube size={18} className={ytExpired ? "text-amber-400" : "text-red-400"} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">YouTube</p>
                      <p className="text-xs text-gray-400">{ytExpired ? "Session expired — reconnect" : "Not connected"}</p>
                    </div>
                  </div>
                  <button onClick={connectYouTube} disabled={ytConnecting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 ${ytExpired ? "bg-amber-500 hover:bg-amber-600" : "bg-red-600 hover:bg-red-700"}`}>
                    <IconYoutube size={12} className={cn("text-white", ytConnecting && "animate-pulse")} />
                    {ytConnecting ? "Redirecting…" : ytExpired ? "Reconnect" : "Connect"}
                  </button>
                </div>
              )}

              {/* Instagram card */}
              {loading ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : igData ? (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card flex items-center gap-3">
                  <div className="shrink-0">
                    {igData.profile_picture_url
                      ? <img src={igData.profile_picture_url} alt={igData.username} width={40} height={40} className="rounded-full ring-2 ring-pink-100" />
                      : <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"><IconInstagram size={18} className="text-white" /></div>
                    }
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">@{igData.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">✓ Live</span>
                      <p className="text-xs text-gray-400 truncate">{fmt(igData.followers_count)} followers</p>
                    </div>
                  </div>
                  <button onClick={connectInstagram} disabled={igConnecting}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 shrink-0">
                    <IconRefresh size={11} className={igConnecting ? "animate-spin" : ""} />
                    Re-connect
                  </button>
                </div>
              ) : (
                <div className={`bg-white rounded-2xl p-4 border-2 border-dashed flex items-center justify-between ${igExpired ? "border-amber-200" : "border-pink-100"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${igExpired ? "bg-amber-50 border-amber-100" : "bg-pink-50 border-pink-100"}`}>
                      <IconInstagram size={18} className={igExpired ? "text-amber-400" : "text-pink-400"} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Instagram</p>
                      <p className="text-xs text-gray-400">{igExpired ? "Session expired — reconnect" : "Not connected"}</p>
                    </div>
                  </div>
                  <button onClick={connectInstagram} disabled={igConnecting}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-60 ${igExpired ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"}`}>
                    <IconInstagram size={12} className={cn("text-white", igConnecting && "animate-pulse")} />
                    {igConnecting ? "Redirecting…" : igExpired ? "Reconnect" : "Connect"}
                  </button>
                </div>
              )}
            </div>
          </section>

          {ytError        && <ErrorAlert message={ytError}        onRetry={refreshMetrics} />}
          {ytConnectError && <ErrorAlert message={ytConnectError} onRetry={connectYouTube} />}
          {igError        && <ErrorAlert message={igError}        onRetry={connectInstagram} />}
          {igConnectError && <ErrorAlert message={igConnectError} onRetry={connectInstagram} />}

          {/* ── Instagram Stats (always visible when connected) ───────────── */}
          {!loading && igConnected === false && !igData && !igExpired && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-card text-center">
              <div className="w-14 h-14 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center mx-auto mb-4">
                <IconInstagram size={24} className="text-pink-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Connect Instagram to see analytics</h3>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">Link your Professional Instagram account to display verified metrics.</p>
              <button onClick={connectInstagram} disabled={igConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-60">
                <IconInstagram size={15} className={cn("text-white", igConnecting && "animate-pulse")} />
                {igConnecting ? "Redirecting…" : "Connect Instagram"}
              </button>
            </div>
          )}

          {/* ── YouTube not connected ─────────────────────────────────────── */}
          {!loading && ytConnected === false && !ytData && !ytExpired && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-card text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
                <IconYoutube size={24} className="text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Connect YouTube to see analytics</h3>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">Link your channel to start showing verified metrics on your public profile.</p>
              <button onClick={connectYouTube} disabled={ytConnecting}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                <IconYoutube size={15} className={cn("text-white", ytConnecting && "animate-pulse")} />
                {ytConnecting ? "Redirecting…" : "Connect YouTube"}
              </button>
            </div>
          )}

          {ytData && analytics && (
            <>
              {/* YouTube platform header */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-red-200 to-transparent" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-100">
                  <IconYoutube size={13} className="text-red-500" />
                  <span className="text-xs font-bold text-red-600">YouTube</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-red-200 to-transparent" />
              </div>

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
                        ? <a href={`/@${profile.username}`} target="_blank" className="text-brand-600 hover:underline">statvora.in/@{profile.username}</a>
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

          {/* ── Instagram Stats ───────────────────────────────────────────── */}
          {igData && (
            <>
              {/* Platform divider */}
              <div className="flex items-center gap-3 pt-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-50 to-pink-50 border border-pink-100">
                  <IconInstagram size={13} className="text-pink-500" />
                  <span className="text-xs font-bold text-pink-600">Instagram</span>
                </div>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-pink-200 to-transparent" />
              </div>

              {/* Insights upgrade nudge — shown when no account-level insights returned */}
              {!igData.account_insights?.account_reach &&
               !igData.account_insights?.profile_views &&
               !igData.account_insights?.website_clicks && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-purple-50 border border-purple-100">
                  <IconInstagram size={16} className="text-purple-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-purple-800">Unlock reach, impressions &amp; audience insights</p>
                    <p className="text-xs text-purple-600 mt-0.5">
                      Go to <strong>Settings → Connections</strong> and click <strong>Reconnect</strong> to grant the insights permission.
                    </p>
                  </div>
                  <button
                    onClick={connectInstagram}
                    disabled={igConnecting}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-all"
                  >
                    {igConnecting ? "Redirecting…" : "Reconnect"}
                  </button>
                </div>
              )}

              {/* Overview */}
              <section>
                <SectionHeader title="Instagram Overview" subtitle="Stats pulled directly from Instagram Graph API." />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard label="Followers"   value={fmt(igData.followers_count)} icon={IconUsers} bg="bg-[#fdf0f6]" iconColor="text-pink-500" />
                  <StatCard label="Total Posts" value={fmt(igData.media_count)}     icon={IconVideo} bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
                  {igData.token_expires_at && (() => {
                    const daysLeft = Math.ceil((new Date(igData.token_expires_at).getTime() - Date.now()) / 86400000);
                    return daysLeft <= 7 ? (
                      <div className="col-span-2 sm:col-span-1 flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-700 text-xs">
                        <IconAlert size={14} className="shrink-0" />
                        Token expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""} — reconnect soon
                      </div>
                    ) : null;
                  })()}
                </div>
              </section>

              {/* Account-level insights — last 7 days */}
              {(() => {
                const ai = igData.account_insights;
                const hasAccountInsights = ai && (
                  ai.account_reach !== undefined || ai.profile_views !== undefined ||
                  ai.website_clicks !== undefined || ai.account_impressions !== undefined
                );
                if (!hasAccountInsights) return null;
                return (
                  <section>
                    <SectionHeader title="Last 7 Days" subtitle="Account-level activity pulled from Instagram Insights." />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {ai!.account_reach       !== undefined && <StatCard label="Account Reach"   value={fmt(ai!.account_reach!)}       icon={IconEye}      bg="bg-[#fdf0f6]" iconColor="text-pink-500" />}
                      {ai!.account_impressions !== undefined && <StatCard label="Impressions"     value={fmt(ai!.account_impressions!)} icon={IconTrendUp}  bg="bg-[#f5f0fe]" iconColor="text-purple-500" />}
                      {ai!.profile_views       !== undefined && <StatCard label="Profile Visits"  value={fmt(ai!.profile_views!)}       icon={IconUsers}    bg="bg-[#f0fdf4]" iconColor="text-emerald-600" />}
                      {ai!.website_clicks      !== undefined && <StatCard label="Website Clicks"  value={fmt(ai!.website_clicks!)}      icon={IconExternal} bg="bg-[#fdf9ec]" iconColor="text-amber-500" />}
                    </div>
                  </section>
                );
              })()}

              {/* Audience demographics */}
              {(() => {
                const ai = igData.account_insights;
                if (!ai) return null;
                const hasGenderAge = !!ai.audience_gender_age && Object.keys(ai.audience_gender_age).length > 0;
                const hasCountry   = !!ai.audience_country    && Object.keys(ai.audience_country).length > 0;
                const hasOnline    = !!ai.online_followers     && Object.keys(ai.online_followers).length > 0;
                if (!hasGenderAge && !hasCountry && !hasOnline) return null;

                // Parse helpers inline
                const gaParsed = hasGenderAge ? (() => {
                  let male = 0; let female = 0;
                  const brackets: { label: string; pct: number }[] = [];
                  for (const [key, val] of Object.entries(ai.audience_gender_age!)) {
                    const pct = val <= 1 ? Math.round(val * 100) : Math.round(val);
                    if (key.startsWith("M.")) male += pct; else if (key.startsWith("F.")) female += pct;
                    brackets.push({ label: key.replace("M.", "M ").replace("F.", "F "), pct });
                  }
                  brackets.sort((a, b) => b.pct - a.pct);
                  return { male, female, brackets: brackets.slice(0, 6) };
                })() : null;

                const countries = hasCountry
                  ? Object.entries(ai.audience_country!)
                      .map(([code, val]) => ({ code, pct: val <= 1 ? Math.round(val * 100) : Math.round(val) }))
                      .sort((a, b) => b.pct - a.pct).slice(0, 5)
                  : null;

                const hours = hasOnline ? (() => {
                  const raw = ai.online_followers!;
                  const maxV = Math.max(...Object.values(raw), 1);
                  return Array.from({ length: 24 }, (_, h) => ({
                    hour: h,
                    label: h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`,
                    count: raw[String(h)] ?? 0,
                    pct: Math.round(((raw[String(h)] ?? 0) / maxV) * 100),
                  }));
                })() : null;
                const peakHour = hours ? hours.reduce((b, h) => h.count > b.count ? h : b, hours[0]) : null;

                return (
                  <section>
                    <SectionHeader title="Audience Insights" subtitle="Demographic breakdown of your followers." />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Gender / Age */}
                      {gaParsed && (
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card space-y-3">
                          <p className="text-xs font-bold text-gray-700">Gender Split</p>
                          <div className="flex rounded-full overflow-hidden h-3">
                            <div className="bg-blue-400" style={{ width: `${gaParsed.male}%` }} />
                            <div className="bg-pink-400 flex-1" />
                          </div>
                          <div className="flex gap-4 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Male {gaParsed.male}%</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />Female {gaParsed.female}%</span>
                          </div>
                          <div className="space-y-1.5 pt-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Top Age Brackets</p>
                            {gaParsed.brackets.map(b => (
                              <div key={b.label} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 w-14 shrink-0">{b.label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-pink-400" style={{ width: `${Math.min(b.pct * 2, 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">{b.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Top Countries */}
                      {countries && (
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card space-y-2">
                          <p className="text-xs font-bold text-gray-700">Top Countries</p>
                          {countries.map(c => (
                            <div key={c.code} className="flex items-center gap-2">
                              <span className="text-[10px] text-gray-500 w-7 shrink-0 font-mono">{c.code}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-purple-400" style={{ width: `${Math.min(c.pct * 1.5, 100)}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">{c.pct}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Best time to post */}
                    {hours && peakHour && (
                      <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card mt-3">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-bold text-gray-700">Best Time to Post</p>
                          <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-0.5 rounded-full">
                            Peak: {peakHour.label} UTC · {fmt(peakHour.count)} online
                          </span>
                        </div>
                        <div className="flex items-end gap-0.5 h-10">
                          {hours.map(h => (
                            <div key={h.hour} className="flex-1 flex flex-col items-center" title={`${h.label}: ${fmt(h.count)}`}>
                              <div className={`w-full rounded-sm ${h.hour === peakHour.hour ? "bg-purple-500" : "bg-purple-200"}`}
                                style={{ height: `${Math.max(h.pct, 4)}%` }} />
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                          <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* Recent posts + per-post insights */}
              {igData.recent_posts.length > 0 && (() => {
                const postsWithInsights    = igData.recent_posts.filter(p => p.reach !== undefined);
                const hasPostInsights      = postsWithInsights.length > 0;
                const avgReach             = hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.reach ?? 0), 0)              / postsWithInsights.length) : 0;
                const avgImpressions       = hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.impressions ?? 0), 0)        / postsWithInsights.length) : 0;
                const avgTotalInteractions = hasPostInsights ? Math.round(postsWithInsights.reduce((s, p) => s + (p.total_interactions ?? 0), 0) / postsWithInsights.length) : 0;
                const totalSaved           = hasPostInsights ? igData.recent_posts.reduce((s, p) => s + (p.saved ?? 0), 0)          : 0;
                const totalShares          = hasPostInsights ? igData.recent_posts.reduce((s, p) => s + (p.shares ?? 0), 0)         : 0;
                const totalFollows         = hasPostInsights ? igData.recent_posts.reduce((s, p) => s + (p.follows ?? 0), 0)        : 0;
                const totalProfileVisits   = hasPostInsights ? igData.recent_posts.reduce((s, p) => s + (p.profile_visits ?? 0), 0) : 0;

                return (
                  <section>
                    <SectionHeader title="Recent Posts" subtitle="Latest 9 posts with per-post insights." />

                    {hasPostInsights && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <StatCard label="Avg Reach"        value={fmt(avgReach)}             icon={IconEye}      bg="bg-[#fdf0f6]" iconColor="text-pink-500" />
                        <StatCard label="Avg Impressions"  value={fmt(avgImpressions)}       icon={IconTrendUp}  bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
                        <StatCard label="Avg Interactions" value={fmt(avgTotalInteractions)} icon={IconThumbUp}  bg="bg-[#fdf9ec]" iconColor="text-amber-500" />
                        <StatCard label="Total Saves"      value={fmt(totalSaved)}           icon={IconBookmark} bg="bg-[#f0fdf4]" iconColor="text-emerald-600" />
                        <StatCard label="Total Shares"     value={fmt(totalShares)}          icon={IconShare}    bg="bg-[#f5f0fe]" iconColor="text-purple-500" />
                        {totalFollows       > 0 && <StatCard label="New Follows"    value={fmt(totalFollows)}       icon={IconUsers}    bg="bg-[#fdf0f6]" iconColor="text-pink-500" />}
                        {totalProfileVisits > 0 && <StatCard label="Profile Visits" value={fmt(totalProfileVisits)} icon={IconExternal} bg="bg-[#fdf9ec]" iconColor="text-amber-500" />}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 max-w-lg">
                      {igData.recent_posts.slice(0, 9).map(post => {
                        const thumb = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
                        return (
                          <div key={post.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100 group">
                            {thumb
                              ? <img src={thumb} alt={post.caption ?? "Post"} className="w-full h-full object-cover" loading="lazy" />
                              : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-pink-100">
                                  <IconInstagram size={20} className="text-pink-300" />
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
                  </section>
                );
              })()}
            </>
          )}

        </div>
      </main>
    </div>
  );
}
