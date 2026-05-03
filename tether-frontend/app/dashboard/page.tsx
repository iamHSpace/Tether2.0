"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { api, YouTubeStatsResponse, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt, timeAgo, cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconUsers, IconEye, IconVideo, IconTrendUp, IconYoutube,
  IconRefresh, IconExternal, IconThumbUp, IconChat,
  IconCopy, IconCheck, IconBell,
} from "@/components/ui/Icons";

interface DashboardProfile { username: string | null; email: string; metricVisibility: MetricVisibility; }

// ── Instagram icon ────────────────────────────────────────────────────────────

function IconInstagram({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

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
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
          enabled ? "translate-x-4" : "translate-x-0"
        )}
      />
    </button>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color = "#7c3aed" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const w = 280; const h = 80;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  const area = `0,${h} ${polyline} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="80" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace("#","")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, Icon, color, trend }: {
  label: string; value: string; Icon: React.ElementType; color: string; trend?: string;
}) {
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      {trend && <p className="text-[11px] text-green-500 font-semibold mt-0.5">{trend}</p>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-400 mt-0.5">{description}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const METRIC_DEFS: { key: keyof MetricVisibility; label: string; description: string; Icon: React.ElementType }[] = [
  { key: "subscribers",   label: "Subscribers",          description: "YouTube subscriber count",           Icon: IconUsers   },
  { key: "total_views",   label: "Total Views",           description: "Lifetime channel view count",        Icon: IconEye     },
  { key: "video_count",   label: "Videos Published",      description: "Total number of uploaded videos",    Icon: IconVideo   },
  { key: "avg_views",     label: "Avg Views / Video",     description: "Average views across all videos",    Icon: IconTrendUp },
  { key: "view_chart",    label: "Performance Chart",     description: "Views & likes chart from recent uploads", Icon: IconEye },
  { key: "recent_videos", label: "Recent Videos",         description: "List of most recent uploads",        Icon: IconVideo   },
];

export default function DashboardPage() {
  const [profile, setProfile]       = useState<DashboardProfile | null>(null);
  const [ytData, setYtData]         = useState<YouTubeStatsResponse | null>(null);
  const [ytError, setYtError]       = useState<string | null>(null);
  const [igPlatform, setIgPlatform] = useState<PlatformInfo | null>(null);
  const [platforms, setPlatforms]   = useState<PlatformInfo[]>([]);
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);
  const [metricVisibility, setMetricVisibility] = useState<MetricVisibility>(DEFAULT_METRIC_VISIBILITY);
  const [savingMetrics, setSavingMetrics]       = useState(false);
  const [metricsSaved, setMetricsSaved]         = useState(false);
  const [refreshing, setRefreshing]             = useState(false);

  // Read URL params (OAuth callbacks redirect here with status params)
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

    try { setYtData(await api.youtube.stats()); }
    catch (err) { setYtError(err instanceof Error ? err.message : String(err)); }

    // Load connected platforms for Instagram detection
    try {
      const { platforms: plats } = await api.creators.get(
        (await api.profile.get()).profile.username ?? ""
      );
      setPlatforms(plats);
      const ig = plats.find(p => p.platform === "instagram") ?? null;
      setIgPlatform(ig);
    } catch {
      // Non-fatal — platforms section degrades gracefully
    }

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
    try {
      setYtData(await api.youtube.stats());
    } catch (err) {
      setYtError(err instanceof Error ? err.message : String(err));
    }
    setRefreshing(false);
  }

  async function saveMetrics(newVisibility: MetricVisibility) {
    setSavingMetrics(true);
    try {
      await api.profile.updateMetrics(newVisibility);
      setMetricsSaved(true);
      setTimeout(() => setMetricsSaved(false), 2500);
    } catch (e) {
      console.error("Failed to save metrics:", e);
    }
    setSavingMetrics(false);
  }

  function toggleMetric(key: keyof MetricVisibility) {
    const updated = { ...metricVisibility, [key]: !metricVisibility[key] };
    setMetricVisibility(updated);
    saveMetrics(updated);
  }

  const viewsData = ytData?.videos.map(v => v.views) ?? [];
  const likesData = ytData?.videos.map(v => v.likes) ?? [];
  const igMeta    = igPlatform?.metadata as { username?: string; followers_count?: number; media_count?: number } | undefined;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar email={profile?.email} username={profile?.username ?? undefined} />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? "Loading…" : `Welcome back${profile?.username ? `, @${profile.username}` : ""}!`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {profile?.username && (
              <button onClick={copyLink}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600 transition-all">
                {copied ? <IconCheck size={13} className="text-green-500" /> : <IconCopy size={13} />}
                {copied ? "Copied!" : "Copy profile link"}
              </button>
            )}
            <button className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50">
              <IconBell size={16} className="text-gray-500" />
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8">

          {/* ── Platform Connections ─────────────────────────────────────────── */}
          <section>
            <SectionHeader
              title="Platform Connections"
              description="Connect your accounts so Tether can pull live, verified metrics."
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* YouTube */}
              {!loading && !ytData ? (
                <div className="card p-5 flex items-center justify-between border-dashed border-2 border-red-100 bg-gradient-to-r from-red-50 to-white">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-red-600 flex items-center justify-center shrink-0">
                      <IconYoutube size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">YouTube</p>
                      <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
                      {ytError && !ytError.includes("not connected") && (
                        <p className="text-[11px] text-red-500 mt-1">{ytError}</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => api.youtube.connect()}
                    className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 shrink-0">
                    <IconYoutube size={13} className="text-white" /> Connect
                  </button>
                </div>
              ) : ytData ? (
                <div className="card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ytData.channel.thumbnail
                      ? <img src={ytData.channel.thumbnail} alt={ytData.channel.name}
                          width={44} height={44} className="rounded-full ring-2 ring-brand-100" />
                      : <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center">
                          <IconYoutube size={22} className="text-white" />
                        </div>
                    }
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{ytData.channel.name}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Connected</span>
                      </div>
                      {ytData.channel.handle && <p className="text-xs text-gray-500">{ytData.channel.handle}</p>}
                      <p className="text-[11px] text-gray-400">Connected {timeAgo(ytData.connectedAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={refreshMetrics} disabled={refreshing}
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1.5 disabled:opacity-50">
                      <IconRefresh size={11} className={refreshing ? "animate-spin" : ""} />
                      {refreshing ? "Refreshing…" : "Refresh metrics"}
                    </button>
                    <a href={`https://youtube.com/channel/${ytData.channel.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1">
                      <IconExternal size={11} />
                    </a>
                  </div>
                </div>
              ) : loading ? (
                <div className="card p-5 h-20 animate-pulse bg-gray-100/60" />
              ) : null}

              {/* Instagram */}
              {!loading && !igPlatform ? (
                <div className="card p-5 flex items-center justify-between border-dashed border-2"
                  style={{ borderColor: "#fbcfe8", background: "linear-gradient(to right, #fdf2f8, white)" }}>
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                      <IconInstagram size={22} className="text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Instagram</p>
                      <p className="text-xs text-gray-400 mt-0.5">Not connected</p>
                      <p className="text-[11px] text-gray-300 mt-0.5">Requires a Professional account linked to a Facebook Page</p>
                    </div>
                  </div>
                  <button onClick={() => api.instagram.connect()}
                    className="text-xs py-2 px-3 rounded-xl font-medium text-white shrink-0 flex items-center gap-1.5 transition-opacity hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #f09433, #bc1888)" }}>
                    <IconInstagram size={13} /> Connect
                  </button>
                </div>
              ) : igPlatform ? (
                <div className="card p-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #f09433 0%, #bc1888 100%)" }}>
                      <IconInstagram size={22} className="text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 text-sm">{igPlatform.platform_username}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">✓ Connected</span>
                      </div>
                      {igMeta?.username && <p className="text-xs text-gray-500">@{igMeta.username}</p>}
                      {igMeta?.followers_count !== undefined && (
                        <p className="text-[11px] text-gray-400">{fmt(igMeta.followers_count)} followers</p>
                      )}
                    </div>
                  </div>
                  {igMeta?.username && (
                    <a href={`https://instagram.com/${igMeta.username}`}
                      target="_blank" rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1.5 px-2.5 flex items-center gap-1 shrink-0">
                      <IconExternal size={11} />
                    </a>
                  )}
                </div>
              ) : loading ? (
                <div className="card p-5 h-20 animate-pulse bg-gray-100/60" />
              ) : null}
            </div>
          </section>

          {/* ── Metric Visibility ────────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Metric Visibility</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Choose which stats appear on your public profile at{" "}
                  {profile?.username
                    ? <a href={`/c/${profile.username}`} target="_blank" className="text-brand-600 font-medium hover:underline">
                        tether.so/c/{profile.username}
                      </a>
                    : "your public profile"
                  }.
                </p>
              </div>
              {metricsSaved && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <IconCheck size={13} /> Saved
                </span>
              )}
              {savingMetrics && !metricsSaved && (
                <span className="text-xs text-gray-400">Saving…</span>
              )}
            </div>

            <div className="card divide-y divide-gray-50">
              {METRIC_DEFS.map(({ key, label, description, Icon }) => (
                <div key={key} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                      <Icon size={15} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400">{description}</p>
                    </div>
                  </div>
                  <Toggle
                    enabled={metricVisibility[key]}
                    onChange={() => toggleMetric(key)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* ── YouTube Stats ────────────────────────────────────────────────── */}
          {ytData && (
            <section>
              <SectionHeader
                title="YouTube Analytics"
                description="Live metrics pulled directly from the YouTube Data API."
              />

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <StatCard label="Subscribers"     value={fmt(ytData.channel.subscribers)} Icon={IconUsers}   color="bg-brand-500" />
                <StatCard label="Total Views"     value={fmt(ytData.channel.totalViews)}  Icon={IconEye}     color="bg-blue-500"  />
                <StatCard label="Videos"          value={fmt(ytData.channel.videoCount)}  Icon={IconVideo}   color="bg-green-500" />
                <StatCard label="Avg Views/Video" Icon={IconTrendUp} color="bg-orange-400"
                  value={fmt(Math.round(ytData.channel.totalViews / (ytData.channel.videoCount || 1)))} />
              </div>

              {/* Charts + recent videos */}
              <div className="grid grid-cols-5 gap-4">
                <div className="card p-5 col-span-3">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">Video Performance</h3>
                      <p className="text-xs text-gray-400">Views & likes across recent uploads</p>
                    </div>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">
                      Last {ytData.videos.length} videos
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-brand-600 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" /> Views
                        </span>
                        <span className="text-xs text-gray-400">{fmt(Math.max(...viewsData))} peak</span>
                      </div>
                      <Sparkline data={viewsData} color="#7c3aed" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Likes
                        </span>
                        <span className="text-xs text-gray-400">{fmt(Math.max(...likesData))} peak</span>
                      </div>
                      <Sparkline data={likesData} color="#3b82f6" />
                    </div>
                  </div>
                </div>

                <div className="card p-5 col-span-2">
                  <h3 className="font-semibold text-gray-900 text-sm mb-4">Recent Videos</h3>
                  <div className="space-y-3.5">
                    {ytData.videos.map(v => (
                      <div key={v.id} className="flex gap-3 items-start">
                        {v.thumbnail && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={v.thumbnail} alt={v.title} width={72} height={44}
                            className="rounded-lg object-cover shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-relaxed">{v.title}</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                            <span className="flex items-center gap-0.5"><IconEye size={10} />{fmt(v.views)}</span>
                            <span className="flex items-center gap-0.5"><IconThumbUp size={10} />{fmt(v.likes)}</span>
                            <span className="flex items-center gap-0.5"><IconChat size={10} />{fmt(v.comments)}</span>
                          </div>
                          <p className="text-[10px] text-gray-300 mt-0.5">{timeAgo(v.publishedAt)}</p>
                        </div>
                      </div>
                    ))}
                    {ytData.videos.length === 0 && (
                      <p className="text-xs text-gray-400">No recent videos found.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Share CTA ────────────────────────────────────────────────────── */}
          {profile?.username && (
            <div className="card p-5 flex items-center justify-between bg-gradient-to-r from-brand-600 to-purple-700 border-0">
              <div>
                <p className="text-white font-semibold">Your verified profile is live 🎉</p>
                <p className="text-brand-200 text-sm mt-0.5">
                  Share this link with brands — no screenshots needed.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={copyLink}
                  className={cn("flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all", "bg-white text-brand-700 hover:bg-brand-50")}>
                  {copied ? <IconCheck size={14} className="text-green-500" /> : <IconCopy size={14} />}
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a href={`/c/${profile.username}`} target="_blank"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all">
                  <IconExternal size={14} /> View profile
                </a>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
