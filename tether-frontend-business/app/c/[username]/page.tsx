"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { api, Profile, PlatformInfo, SnapshotData } from "@/lib/api";
import { fmt, timeAgo } from "@/lib/utils";
import {
  IconYoutube, IconExternal, IconShield, IconBookmark, IconBookmarkFilled,
  IconCheck, IconUsers, IconEye, IconVideo, IconTrendUp, IconAlert,
} from "@/components/ui/Icons";

// ── Charts (same as creator public profile) ────────────────────────────────────

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

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/80 rounded-xl ${className}`} />;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const stageLabels: Record<string, string> = {
  just_starting: "Just starting out", growing: "Growing fast",
  established: "Established creator", pro: "Pro creator",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BusinessCreatorProfile() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";

  const [profile, setProfile]     = useState<Profile | null>(null);
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, { data: SnapshotData; captured_at: string }>>({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [notFound, setNotFound]   = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSaved, setIsSaved]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState<"saved" | "unsaved" | null>(null);
  const [showAllVideos, setShowAllVideos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);

      const data = await api.creators.get(username);
      setProfile(data.profile);
      setPlatforms(data.platforms ?? []);
      setSnapshots(data.snapshots ?? {});

      if (user) {
        const { saved } = await api.saved.list();
        setIsSaved(saved.some(s => s.creator_username === username));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) setNotFound(true);
      else setError(msg);
    }
    setLoading(false);
  }, [username]);

  useEffect(() => { if (username) load(); }, [username, load]);

  async function toggleSave() {
    if (!isLoggedIn) { window.location.href = `/login?next=/c/${username}`; return; }
    setSaving(true);
    try {
      if (isSaved) {
        await api.saved.unsave(username);
        setIsSaved(false); setSaveMsg("unsaved");
      } else {
        await api.saved.save(username);
        setIsSaved(true); setSaveMsg("saved");
      }
      setTimeout(() => setSaveMsg(null), 2000);
    } catch { /* non-fatal */ }
    setSaving(false);
  }

  // ── All hooks before conditionals ────────────────────────────────────────────

  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const ytSnap = snapshots["youtube"];
  const ytData: SnapshotData | null = ytSnap?.data ?? null;
  const capturedAt = ytSnap?.captured_at ?? null;
  const mv = profile?.metric_visibility ?? {
    subscribers: true, total_views: true, video_count: true,
    avg_views: true, view_chart: true, recent_videos: true,
  };

  const analytics = useMemo(() => {
    if (!ytData || !ytData.videos.length) return null;
    const videos = ytData.videos;
    const ch = ytData.channel;
    const sorted = [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    const accountAgeDays = sorted.length > 1
      ? Math.round((new Date(sorted[sorted.length - 1].publishedAt).getTime() - new Date(sorted[0].publishedAt).getTime()) / 86400000) : 0;
    const knownViews = videos.reduce((s, v) => s + v.views, 0);
    const ghostViews = Math.max(0, ch.totalViews - knownViews);
    const subToViewRatio = ch.subscribers > 0 ? ch.totalViews / ch.subscribers : 0;
    const uploadVelocity = sorted.length > 1 ? accountAgeDays / (sorted.length - 1) : 0;
    const withMetrics = videos.map(v => ({
      ...v,
      engagementScore: v.likes * 2 + v.comments,
      interactionRate: v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0,
    }));
    const weekdayBuckets = WEEKDAYS.map((day, i) => {
      const dayVids = videos.filter(v => new Date(v.publishedAt).getDay() === i);
      return { label: day, value: dayVids.length > 0 ? Math.round(dayVids.reduce((s, v) => s + v.views, 0) / dayVids.length) : 0 };
    });
    const bestDay = weekdayBuckets.reduce((best, b) => b.value > best.value ? b : best, weekdayBuckets[0]);
    const recentDecay = [...sorted].reverse().slice(0, 6).map(v => v.views);
    return { accountAgeDays, ghostViews, subToViewRatio, uploadVelocity, withMetrics, weekdayBuckets, bestDay, recentDecay };
  }, [ytData]);

  const visibleVideos = useMemo(
    () => analytics ? (showAllVideos ? analytics.withMetrics : analytics.withMetrics.slice(0, 5)) : [],
    [analytics, showAllVideos]
  );

  const initials = (profile?.full_name?.[0] ?? profile?.username?.[0] ?? "?").toUpperCase();

  // ── Conditional renders (after all hooks) ────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8]">
        <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Tether</span>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-6 py-10 space-y-4">
          <div className="flex items-center gap-4"><Skeleton className="w-20 h-20 rounded-2xl" /><div className="space-y-2 flex-1"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-24" /></div></div>
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <IconAlert size={24} className="text-red-400" />
        </div>
        <div><h1 className="text-lg font-bold text-gray-900 mb-1">Could not load profile</h1><p className="text-sm text-gray-400 max-w-xs">{error}</p></div>
        <button onClick={load} className="btn-primary">Try again</button>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl mb-2">🔍</div>
        <h1 className="text-xl font-bold text-gray-900">Creator not found</h1>
        <p className="text-sm text-gray-400">No creator with username <strong>@{username}</strong> was found.</p>
        <a href="/dashboard" className="btn-primary mt-1">Back to dashboard</a>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Tether</span>
            <span className="text-[10px] font-semibold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">Business</span>
          </a>

          <div className="flex items-center gap-2">
            {/* Save / Login to save */}
            <button onClick={toggleSave} disabled={saving}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isSaved
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
              }`}>
              {isSaved ? <IconBookmarkFilled size={13} /> : <IconBookmark size={13} />}
              {saving ? "…" : saveMsg === "saved" ? "Saved!" : saveMsg === "unsaved" ? "Removed" : isSaved ? "Saved" : isLoggedIn ? "Save creator" : "Login to save"}
            </button>
            {!isLoggedIn && (
              <a href="/login" className="btn-primary text-xs py-2 px-3.5">Sign in</a>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-5">

        {/* Hero */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card">
          <div className="flex items-start gap-5">
            <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white text-2xl font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{profile.full_name ?? `@${profile.username}`}</h1>
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
          </div>
        </div>

        {/* Verified notice */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-green-50 border border-green-100">
          <IconShield size={15} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700">
            All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported.
            {capturedAt && <span className="text-green-500 ml-1">Last updated {timeAgo(capturedAt)}.</span>}
          </p>
        </div>

        {/* No platforms */}
        {!ytPlatform && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center">
            <p className="text-sm text-gray-400">No platforms connected yet.</p>
          </div>
        )}

        {/* YouTube: connected but no snapshot */}
        {ytPlatform && !ytData && (
          <div className="bg-white rounded-2xl p-6 border border-dashed border-gray-200 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto">
              <IconYoutube size={18} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">YouTube connected</p>
            <p className="text-xs text-gray-400">Metrics will appear once the creator refreshes their dashboard.</p>
          </div>
        )}

        {/* YouTube metrics */}
        {ytPlatform && ytData && (
          <div className="space-y-4">
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

            {/* Overview cards */}
            {(mv.subscribers || mv.total_views || mv.video_count || mv.avg_views) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {mv.subscribers && <MetricCard icon={IconUsers} label="Subscribers" value={fmt(ytData.channel.subscribers)} bg="bg-[#e8f5f0]" iconColor="text-emerald-600" />}
                {mv.total_views && <MetricCard icon={IconEye} label="Total Views" value={fmt(ytData.channel.totalViews)} bg="bg-[#fef9ec]" iconColor="text-amber-500" />}
                {mv.video_count && <MetricCard icon={IconVideo} label="Videos" value={fmt(ytData.channel.videoCount)} bg="bg-[#f0f0fe]" iconColor="text-brand-600" />}
                {mv.avg_views && <MetricCard icon={IconTrendUp} label="Avg Views/Video" value={fmt(Math.round(ytData.channel.totalViews / Math.max(ytData.channel.videoCount, 1)))} bg="bg-[#fdf0f3]" iconColor="text-rose-500" />}
              </div>
            )}

            {/* Derived insights for business */}
            {analytics && mv.avg_views && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Partnership Insights</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{Math.round(analytics.subToViewRatio * 10) / 10}×</p>
                    <p className="text-xs text-gray-400 mt-0.5">Sub-to-View Ratio</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{analytics.uploadVelocity > 0 ? `${Math.round(analytics.uploadVelocity * 10) / 10}d` : "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Avg Upload Cadence</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{analytics.accountAgeDays > 0 ? `${analytics.accountAgeDays}d` : "—"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Content Span</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{analytics.bestDay.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Best Day to Post</p>
                  </div>
                </div>
              </div>
            )}

            {/* Views chart */}
            {mv.view_chart && analytics && ytData.videos.length >= 2 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Views by Video</h3>
                  <p className="text-xs text-gray-400 mb-3">Oldest → newest ({ytData.videos.length} videos)</p>
                  <AreaChart
                    data={[...ytData.videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).map(v => v.views)}
                    color="#7c3aed" gradientId="biz-views" />
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Recency Trend</h3>
                  <p className="text-xs text-gray-400 mb-3">Views on last 6 uploads</p>
                  <AreaChart data={analytics.recentDecay} color="#f59e0b" gradientId="biz-decay" />
                </div>
              </div>
            )}

            {/* Recent videos */}
            {mv.recent_videos && analytics && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
                  <h3 className="text-sm font-bold text-gray-900">Recent Videos</h3>
                  <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">{ytData.videos.length} total</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {visibleVideos.map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50">
                      {v.thumbnail
                        ? <img src={v.thumbnail} alt={v.title ?? "Video"} width={72} height={44} className="rounded-xl object-cover shrink-0 border border-gray-100" />
                        : <div className="w-[72px] h-11 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><IconVideo size={14} className="text-gray-300" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 line-clamp-1">{v.title || <span className="italic text-gray-300">Untitled</span>}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(v.publishedAt)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><IconEye size={11} className="text-gray-300" />{fmt(v.views)}</span>
                        <span className="hidden sm:flex">{v.interactionRate.toFixed(1)}% interact</span>
                        <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                          className="w-6 h-6 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100">
                          <IconExternal size={10} className="text-gray-400" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
                {analytics.withMetrics.length > 5 && (
                  <div className="px-5 py-3 border-t border-gray-50">
                    <button onClick={() => setShowAllVideos(v => !v)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                      {showAllVideos ? "Show less" : `Show all ${analytics.withMetrics.length} videos`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* About */}
        {(profile.creator_stage || profile.website) && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">About</h2>
            <dl className="space-y-2">
              {profile.creator_stage && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Creator stage</dt>
                  <dd className="font-medium text-gray-800">{stageLabels[profile.creator_stage] ?? profile.creator_stage}</dd>
                </div>
              )}
              {profile.website && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Website</dt>
                  <dd><a href={profile.website} target="_blank" rel="noopener noreferrer"
                    className="font-medium text-brand-600 hover:underline flex items-center gap-1">
                    {profile.website.replace(/^https?:\/\//, "")} <IconExternal size={10} />
                  </a></dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Save CTA for unauthenticated visitors */}
        {!isLoggedIn && (
          <div className="bg-brand-600 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-sm">Want to save this creator?</p>
              <p className="text-brand-200 text-xs mt-0.5">Create a free business account to build your creator shortlist.</p>
            </div>
            <a href={`/signup`} className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white text-brand-700 hover:bg-brand-50">
              <IconBookmark size={12} /> Get started free
            </a>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400">Powered by <a href="/" className="text-brand-600 font-medium hover:underline">Tether</a> — verified creator metrics</p>
        </div>

      </main>
    </div>
  );
}
