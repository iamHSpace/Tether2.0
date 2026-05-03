"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt } from "@/lib/utils";
import {
  IconYoutube, IconExternal, IconShield, IconShare, IconCheck,
  IconUsers, IconEye, IconVideo, IconTrendUp, IconAlert,
} from "@/components/ui/Icons";

// ── Instagram icon ─────────────────────────────────────────────────────────────

function IconInstagram({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

// ── Bezier area chart ──────────────────────────────────────────────────────────

function AreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return null;
  const W = 500; const H = 80;
  const max = Math.max(...data); const min = Math.min(...data);
  const range = max - min || 1;
  const pts: [number, number][] = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - 8 - ((v - min) / range) * (H - 16),
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
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon, label, value, bg, iconColor,
}: { icon: React.ElementType; label: string; value: string; bg: string; iconColor: string }) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col items-center gap-1.5 text-center border border-white/60 ${bg}`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-white/50 mb-0.5 ${iconColor}`}>
        <Icon size={15} />
      </div>
      <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/80 rounded-xl ${className}`} />;
}

// ── Page state ─────────────────────────────────────────────────────────────────

interface PageState { profile: Profile | null; platforms: PlatformInfo[]; notFound: boolean; }

const stageLabels: Record<string, string> = {
  just_starting: "Just starting out",
  growing:       "Growing fast",
  established:   "Established creator",
  pro:           "Pro creator",
};

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CreatorPublicProfile() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";

  const [state, setState] = useState<PageState>({ profile: null, platforms: [], notFound: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { profile, platforms } = await api.creators.get(username);
      setState({ profile, platforms, notFound: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setState(s => ({ ...s, notFound: true }));
      } else {
        setError(msg);
      }
    }
    setLoading(false);
  }

  useEffect(() => { if (username) load(); }, [username]); // eslint-disable-line react-hooks/exhaustive-deps

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8]">
        <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-800">Tether</span>
            </div>
          </div>
        </nav>
        <main className="max-w-2xl mx-auto px-6 py-10 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-6 w-40 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-3 w-64 rounded" />
            </div>
          </div>
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </main>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <IconAlert size={24} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 mb-1">Could not load profile</h1>
          <p className="text-sm text-gray-400 max-w-xs">{error}</p>
        </div>
        <button onClick={load}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
          Try again
        </button>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (state.notFound) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl mb-2">🔍</div>
        <h1 className="text-xl font-bold text-gray-900">Profile not found</h1>
        <p className="text-sm text-gray-400">No creator with the username <strong>@{username}</strong> was found.</p>
        <a href="/" className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors mt-1">
          Go home
        </a>
      </div>
    );
  }

  // ── Profile ──────────────────────────────────────────────────────────────────
  const { profile, platforms } = state;
  const mv: MetricVisibility = (profile?.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;

  const ytPlatform = platforms.find(p => p.platform === "youtube") ?? null;
  const igPlatform = platforms.find(p => p.platform === "instagram") ?? null;
  const ytMeta = ytPlatform?.metadata as {
    handle?: string; thumbnail?: string;
    subscribers?: number; totalViews?: number; videoCount?: number;
  } | undefined;
  const igMeta = igPlatform?.metadata as {
    username?: string; followers_count?: number; media_count?: number;
  } | undefined;

  const avgViews = ytMeta?.totalViews && ytMeta?.videoCount
    ? Math.round(ytMeta.totalViews / Math.max(ytMeta.videoCount, 1))
    : null;

  const initials = (profile?.full_name?.[0] ?? profile?.username?.[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      {/* Top nav */}
      <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-gray-800">Tether</span>
          </div>
          <button onClick={share}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 shadow-sm transition-colors">
            {copied ? <IconCheck size={12} className="text-green-500" /> : <IconShare size={12} />}
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-5">

        {/* Hero card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-card">
          <div className="flex items-start gap-5">
            <div className="w-18 h-18 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white text-2xl font-bold w-[72px] h-[72px]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {profile?.full_name ?? `@${profile?.username}`}
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700">
                  <IconShield size={9} /> Verified
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">@{profile?.username}</p>
              {profile?.bio && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{profile.bio}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {profile?.creator_stage && (
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
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
                    style={{ background: "#fdf2f8", color: "#9d174d", borderColor: "#fbcfe8" }}>
                    <IconInstagram size={10} /> Instagram
                  </span>
                )}
              </div>
            </div>
            <a href="/login"
              className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
              Join Tether
            </a>
          </div>
        </div>

        {/* Verified notice */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-green-50 border border-green-100">
          <IconShield size={15} className="text-green-600 shrink-0" />
          <p className="text-xs text-green-700">
            All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported.
          </p>
        </div>

        {/* YouTube section */}
        {ytPlatform && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center">
                  <IconYoutube size={17} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{ytPlatform.platform_username}</p>
                  {ytMeta?.handle && <p className="text-xs text-gray-400">{ytMeta.handle}</p>}
                </div>
              </div>
              <a href={`https://youtube.com/channel/${ytPlatform.platform_user_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                <IconExternal size={11} /> View
              </a>
            </div>

            <div className="p-5">
              {/* Metric cards */}
              {(mv.subscribers || mv.total_views || mv.video_count || mv.avg_views) ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {mv.subscribers && ytMeta?.subscribers !== undefined && (
                    <MetricCard icon={IconUsers} label="Subscribers" value={fmt(ytMeta.subscribers)} bg="bg-[#e8f5f0]" iconColor="text-emerald-600" />
                  )}
                  {mv.total_views && ytMeta?.totalViews !== undefined && (
                    <MetricCard icon={IconEye} label="Total Views" value={fmt(ytMeta.totalViews)} bg="bg-[#fef9ec]" iconColor="text-amber-500" />
                  )}
                  {mv.video_count && ytMeta?.videoCount !== undefined && (
                    <MetricCard icon={IconVideo} label="Videos" value={fmt(ytMeta.videoCount)} bg="bg-[#f0f0fe]" iconColor="text-brand-600" />
                  )}
                  {mv.avg_views && avgViews !== null && (
                    <MetricCard icon={IconTrendUp} label="Avg Views" value={fmt(avgViews)} bg="bg-[#fdf0f3]" iconColor="text-rose-500" />
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center mb-4">
                  <p className="text-xs text-gray-400">Creator has chosen not to share detailed metrics publicly.</p>
                </div>
              )}

              {/* Chart placeholder — public profile shows chart only if creator allows */}
              {mv.view_chart && (
                <div className="text-xs text-gray-400 mb-2 font-medium">Channel performance</div>
              )}
            </div>
          </div>
        )}

        {/* Instagram section */}
        {igPlatform && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}>
                  <IconInstagram size={17} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{igPlatform.platform_username}</p>
                  {igMeta?.username && <p className="text-xs text-gray-400">@{igMeta.username}</p>}
                </div>
              </div>
              {igMeta?.username && (
                <a href={`https://instagram.com/${igMeta.username}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <IconExternal size={11} /> View
                </a>
              )}
            </div>
            <div className="p-5">
              {mv.subscribers && igMeta?.followers_count !== undefined ? (
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard icon={IconUsers} label="Followers" value={fmt(igMeta.followers_count)} bg="bg-[#fdf0f3]" iconColor="text-pink-500" />
                  {igMeta.media_count !== undefined && (
                    <MetricCard icon={IconVideo} label="Posts" value={fmt(igMeta.media_count)} bg="bg-[#fef9ec]" iconColor="text-amber-500" />
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">Metrics hidden by creator.</p>
              )}
            </div>
          </div>
        )}

        {/* No platforms */}
        {!ytPlatform && !igPlatform && (
          <div className="bg-white rounded-2xl p-8 border border-dashed border-gray-200 text-center">
            <p className="text-sm text-gray-400">No platforms connected yet.</p>
          </div>
        )}

        {/* About */}
        {(profile?.creator_stage || profile?.aspiration || profile?.website) && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">About</h2>
            <dl className="space-y-2">
              {profile?.creator_stage && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Creator stage</dt>
                  <dd className="font-medium text-gray-800">{stageLabels[profile.creator_stage] ?? profile.creator_stage}</dd>
                </div>
              )}
              {profile?.aspiration && (
                <div className="flex items-center justify-between text-sm">
                  <dt className="text-gray-400">Aspiration</dt>
                  <dd className="font-medium text-gray-800">{profile.aspiration.replace(/_/g, " ")}</dd>
                </div>
              )}
              {profile?.website && (
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

        {/* Footer CTA */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400 mb-3">
            Powered by <a href="/" className="text-brand-600 font-medium hover:underline">Tether</a> — verified creator metrics
          </p>
          <a href="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            Create your verified profile →
          </a>
        </div>

      </main>
    </div>
  );
}
