"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { api, YouTubeStatsResponse, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt, timeAgo, cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconUsers, IconEye, IconVideo, IconTrendUp, IconYoutube,
  IconRefresh, IconExternal, IconThumbUp, IconChat,
  IconCopy, IconCheck, IconBell, IconAlert,
} from "@/components/ui/Icons";

// ── Instagram icon ─────────────────────────────────────────────────────────────

function IconInstagram({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        enabled ? "bg-brand-600" : "bg-gray-200"
      )}
      aria-pressed={enabled}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
        enabled ? "translate-x-4" : "translate-x-0"
      )} />
    </button>
  );
}

// ── Bezier area chart ──────────────────────────────────────────────────────────

function AreaChart({
  data, color, gradientId,
}: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return <div className="h-24 flex items-center justify-center text-xs text-gray-300">Not enough data</div>;
  const W = 500; const H = 96;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - 10 - ((v - min) / range) * (H - 20),
  ]);
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
        <button onClick={onRetry}
          className="shrink-0 text-xs font-medium text-red-600 hover:text-red-800 transition-colors px-2 py-1 rounded-lg hover:bg-red-100">
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
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="h-7 w-20 rounded-lg" />
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  bg: string;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, bg, iconColor }: StatCardProps) {
  return (
    <div className={cn("rounded-2xl p-5 border border-white/60 shadow-card", bg)}>
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", iconColor, "bg-white/50")}>
        <Icon size={17} className={iconColor} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold text-gray-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Metric defs ────────────────────────────────────────────────────────────────

const METRIC_DEFS: { key: keyof MetricVisibility; label: string; desc: string; Icon: React.ElementType }[] = [
  { key: "subscribers",   label: "Subscribers",        desc: "YouTube subscriber count",            Icon: IconUsers   },
  { key: "total_views",   label: "Total Views",         desc: "Lifetime channel view count",         Icon: IconEye     },
  { key: "video_count",   label: "Videos Published",    desc: "Total number of uploaded videos",     Icon: IconVideo   },
  { key: "avg_views",     label: "Avg Views / Video",   desc: "Average views across all videos",     Icon: IconTrendUp },
  { key: "view_chart",    label: "Performance Chart",   desc: "Views chart from recent uploads",     Icon: IconEye     },
  { key: "recent_videos", label: "Recent Videos",       desc: "List of most recent uploads",         Icon: IconVideo   },
];

// ── Page ───────────────────────────────────────────────────────────────────────

interface DashboardProfile { username: string | null; email: string; metricVisibility: MetricVisibility; }

export default function DashboardPage() {
  const [profile, setProfile]         = useState<DashboardProfile | null>(null);
  const [ytData, setYtData]           = useState<YouTubeStatsResponse | null>(null);
  const [ytError, setYtError]         = useState<string | null>(null);
  const [igPlatform, setIgPlatform]   = useState<PlatformInfo | null>(null);
  const [loading, setLoading]         = useState(true);
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [copied, setCopied]           = useState(false);
  const [metricVisibility, setMetricVisibility] = useState<MetricVisibility>(DEFAULT_METRIC_VISIBILITY);
  const [savingMetrics, setSavingMetrics]       = useState(false);
  const [metricsSaved, setMetricsSaved]         = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("youtube_connected") || params.has("instagram_connected") ||
        params.has("youtube_error") || params.has("instagram_error")) {
      window.history.replaceState({}, "", "/dashboard");
    }
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    try {
      const { profile: prof, email } = await api.profile.get();
      const mv = prof.metric_visibility ?? DEFAULT_METRIC_VISIBILITY;
      setProfile({ username: prof.username, email: email ?? user.email ?? "", metricVisibility: mv });
      setMetricVisibility(mv);
    } catch {
      setProfile({ username: null, email: user.email ?? "", metricVisibility: DEFAULT_METRIC_VISIBILITY });
    }

    try {
      const data = await api.youtube.stats();
      setYtData(data);
      setYtConnected(true);
      setYtError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("not connected") || msg.toLowerCase().includes("no youtube")) {
        setYtConnected(false);
      } else {
        setYtConnected(true);
        setYtError(msg);
      }
    }

    try {
      const { profile: prof } = await api.profile.get();
      if (prof.username) {
        const { platforms } = await api.creators.get(prof.username);
        const ig = platforms.find(p => p.platform === "instagram") ?? null;
        setIgPlatform(ig);
      }
    } catch { /* non-fatal */ }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/c/${profile?.username ?? "me"}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function refreshMetrics() {
    setRefreshing(true);
    setYtError(null);
    try {
      setYtData(await api.youtube.stats());
    } catch (err) {
      setYtError(err instanceof Error ? err.message : String(err));
    }
    setRefreshing(false);
  }

  async function saveMetrics(vis: MetricVisibility) {
    setSavingMetrics(true);
    try {
      await api.profile.updateMetrics(vis);
      setMetricsSaved(true);
      setTimeout(() => setMetricsSaved(false), 2500);
    } catch { /* non-fatal */ }
    setSavingMetrics(false);
  }

  function toggleMetric(key: keyof MetricVisibility) {
    const updated = { ...metricVisibility, [key]: !metricVisibility[key] };
    setMetricVisibility(updated);
    saveMetrics(updated);
  }

  const viewsData = ytData?.videos.map(v => v.views) ?? [];
  const igMeta = igPlatform?.metadata as { username?: string; followers_count?: number; media_count?: number } | undefined;
  const avgViews = ytData ? Math.round(ytData.channel.totalViews / (ytData.channel.videoCount || 1)) : 0;

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
            <p className="text-xs text-gray-400 mt-0.5">Here&apos;s your creator dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.username && (
              <button onClick={copyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-all shadow-sm">
                {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
                {copied ? "Copied!" : "Copy profile link"}
              </button>
            )}
            <button className="w-8 h-8 rounded-xl border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 shadow-sm">
              <IconBell size={14} className="text-gray-400" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-7 max-w-6xl">

          {/* ── Stat cards ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              <StatCardSkeleton /><StatCardSkeleton /><StatCardSkeleton />
            </div>
          ) : ytData ? (
            <div className="grid grid-cols-3 gap-4">
              <StatCard
                label="Subscribers"
                value={fmt(ytData.channel.subscribers)}
                icon={IconUsers}
                bg="bg-[#e8f5f0]"
                iconColor="text-emerald-600"
              />
              <StatCard
                label="Total Views"
                value={fmt(ytData.channel.totalViews)}
                icon={IconEye}
                bg="bg-[#fef9ec]"
                iconColor="text-amber-500"
              />
              <StatCard
                label="Avg Views / Video"
                value={fmt(avgViews)}
                icon={IconTrendUp}
                bg="bg-[#fdf0f3]"
                iconColor="text-rose-500"
              />
            </div>
          ) : ytError ? (
            <ErrorAlert message={ytError} onRetry={refreshMetrics} />
          ) : null}

          {/* ── Platform connections ───────────────────────────────────────── */}
          <section>
            <SectionHeader title="Platform Connections" subtitle="Connect your accounts to pull live, verified metrics." />
            <div className="grid grid-cols-2 gap-4">
              {/* YouTube */}
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
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={refreshMetrics} disabled={refreshing}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-all">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors shrink-0">
                    <IconYoutube size={12} className="text-white" /> Connect
                  </button>
                </div>
              )}

              {/* Instagram */}
              {loading ? (
                <Skeleton className="h-20 rounded-2xl" />
              ) : igPlatform ? (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
                      <IconInstagram size={18} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{igPlatform.platform_username}</p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Live</span>
                      </div>
                      {igMeta?.followers_count !== undefined && (
                        <p className="text-xs text-gray-400">{fmt(igMeta.followers_count)} followers</p>
                      )}
                    </div>
                  </div>
                  {igMeta?.username && (
                    <a href={`https://instagram.com/${igMeta.username}`} target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50">
                      <IconExternal size={11} className="text-gray-400" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-4 border-2 border-dashed border-pink-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center">
                      <IconInstagram size={18} className="text-pink-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Instagram</p>
                      <p className="text-xs text-gray-400">Requires a Professional account</p>
                    </div>
                  </div>
                  <button onClick={() => api.instagram.connect()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white shrink-0 hover:opacity-90 transition-opacity"
                    style={{ background: "linear-gradient(135deg,#f09433,#bc1888)" }}>
                    <IconInstagram size={12} /> Connect
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── YouTube Analytics ──────────────────────────────────────────── */}
          {ytData && (
            <section>
              <SectionHeader title="YouTube Analytics" subtitle="Live metrics pulled directly from the YouTube Data API." />

              {/* Area chart */}
              {viewsData.length >= 2 && (
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">Video Performance</h3>
                      <p className="text-xs text-gray-400">Views across recent uploads</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                      <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
                      Last {ytData.videos.length} videos
                    </div>
                  </div>
                  <AreaChart data={viewsData} color="#7c3aed" gradientId="views-area" />
                  <div className="flex items-center justify-between mt-2 text-[11px] text-gray-300 px-1">
                    <span>Oldest</span>
                    <span>Peak: {fmt(Math.max(...viewsData))} views</span>
                    <span>Latest</span>
                  </div>
                </div>
              )}

              {/* Post activity table */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-900">Post Activity</h3>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
                    {ytData.videos.length} videos
                  </span>
                </div>
                {ytData.videos.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-gray-400">No videos found on this channel.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {ytData.videos.map(v => (
                      <div key={v.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                        {v.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnail} alt={v.title} width={80} height={48}
                            className="rounded-xl object-cover shrink-0 border border-gray-100" />
                        ) : (
                          <div className="w-20 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                            <IconVideo size={16} className="text-gray-300" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 line-clamp-1">{v.title}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(v.publishedAt)}</p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <IconEye size={12} className="text-gray-300" /> {fmt(v.views)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconThumbUp size={12} className="text-gray-300" /> {fmt(v.likes)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconChat size={12} className="text-gray-300" /> {fmt(v.comments)}
                          </span>
                          <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                            className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
                            <IconExternal size={10} className="text-gray-400" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── No YouTube connected state ─────────────────────────────────── */}
          {!loading && ytConnected === false && !ytData && (
            <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-card text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-4">
                <IconYoutube size={24} className="text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">Connect YouTube to see analytics</h3>
              <p className="text-xs text-gray-400 mb-4 max-w-xs mx-auto">
                Link your YouTube channel to start showing verified metrics on your public profile.
              </p>
              <button onClick={() => api.youtube.connect()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                <IconYoutube size={15} className="text-white" /> Connect YouTube
              </button>
            </div>
          )}

          {/* ── Metric Visibility ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Metric Visibility</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Control what appears on your public profile at{" "}
                  {profile?.username
                    ? <a href={`/c/${profile.username}`} target="_blank" className="text-brand-600 hover:underline">
                        tether.so/c/{profile.username}
                      </a>
                    : "your public profile"
                  }.
                </p>
              </div>
              {metricsSaved && (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                  <IconCheck size={12} /> Saved
                </span>
              )}
              {savingMetrics && !metricsSaved && (
                <span className="text-xs text-gray-400">Saving…</span>
              )}
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

          {/* ── Share CTA ──────────────────────────────────────────────────── */}
          {profile?.username && (
            <div className="bg-gradient-to-r from-brand-600 to-purple-700 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-sm">Your verified profile is live</p>
                <p className="text-brand-200 text-xs mt-0.5">
                  Share tether.so/c/{profile.username} with brands — no screenshots needed.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={copyLink}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-brand-700 hover:bg-brand-50 transition-colors">
                  {copied ? <IconCheck size={12} className="text-green-500" /> : <IconCopy size={12} />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a href={`/c/${profile.username}`} target="_blank"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/15 text-white hover:bg-white/25 transition-colors">
                  <IconExternal size={12} /> View
                </a>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
