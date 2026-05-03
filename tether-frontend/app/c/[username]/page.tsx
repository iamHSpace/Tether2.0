"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY } from "@/lib/api";
import { fmt } from "@/lib/utils";
import {
  IconYoutube, IconExternal, IconShield, IconShare, IconCheck, IconUsers, IconEye, IconVideo, IconTrendUp
} from "@/components/ui/Icons";

interface PageState {
  profile: Profile | null;
  platforms: PlatformInfo[];
  notFound: boolean;
}

function BadgeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-2xl bg-gray-50 border border-gray-100">
      <div className="w-8 h-8 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
        <Icon size={15} className="text-brand-600" />
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
    </div>
  );
}

// Instagram icon (inline SVG, no external dep)
function IconInstagram({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

export default function CreatorPublicProfile() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";

  const [state, setState] = useState<PageState>({ profile: null, platforms: [], notFound: false });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    async function load() {
      try {
        const { profile, platforms } = await api.creators.get(username);
        setState({ profile, platforms, notFound: false });
      } catch {
        setState(s => ({ ...s, notFound: true }));
      }
      setLoading(false);
    }
    load();
  }, [username]);

  function share() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stageLabels: Record<string, string> = {
    just_starting: "🌱 Just starting out",
    growing:       "🚀 Growing fast",
    established:   "⭐ Established",
    pro:           "👑 Pro creator",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-center p-4">
        <p className="text-6xl">🔍</p>
        <h1 className="text-2xl font-bold text-gray-900">Profile not found</h1>
        <p className="text-gray-500">No creator found with username <strong>@{username}</strong></p>
        <a href="/" className="btn-primary mt-2 text-sm">Go home</a>
      </div>
    );
  }

  const { profile, platforms } = state;
  const mv: MetricVisibility = (profile?.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;

  const ytPlatform   = platforms.find(p => p.platform === "youtube") ?? null;
  const igPlatform   = platforms.find(p => p.platform === "instagram") ?? null;
  const ytMeta       = ytPlatform?.metadata as { handle?: string; thumbnail?: string; subscribers?: number; totalViews?: number; videoCount?: number } | undefined;
  const igMeta       = igPlatform?.metadata as { username?: string; followers_count?: number; media_count?: number; profile_picture_url?: string } | undefined;

  const hasAnyPlatform = ytPlatform || igPlatform;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Top nav */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-bold text-gray-800">Tether</span>
        </div>
        <button onClick={share}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 text-gray-600">
          {copied ? <IconCheck size={12} className="text-green-500" /> : <IconShare size={12} />}
          {copied ? "Copied!" : "Share profile"}
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white text-3xl font-bold">
            {profile?.full_name?.[0] ?? profile?.username?.[0]?.toUpperCase() ?? "?"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile?.full_name ?? `@${profile?.username}`}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                <IconShield size={10} /> Verified by Tether
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">@{profile?.username}</p>
            {profile?.bio && <p className="text-sm text-gray-600 mt-2 leading-relaxed">{profile.bio}</p>}
            {profile?.creator_stage && (
              <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 font-medium">
                {stageLabels[profile.creator_stage] ?? profile.creator_stage}
              </span>
            )}

            {/* Platform badges */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {ytPlatform && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium border border-red-100">
                  <IconYoutube size={11} /> YouTube
                </span>
              )}
              {igPlatform && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{ background: "#fdf2f8", color: "#9d174d", borderColor: "#fbcfe8" }}>
                  <IconInstagram size={11} /> Instagram
                </span>
              )}
            </div>
          </div>

          <a href="/login" className="btn-primary text-sm shrink-0">
            Join Tether
          </a>
        </div>

        {/* Verified notice */}
        <div className="mb-6 p-3.5 rounded-xl bg-green-50 border border-green-100 flex items-center gap-2.5 text-sm text-green-700">
          <IconShield size={16} className="shrink-0" />
          <span>All metrics on this page are <strong>pulled directly from platform APIs</strong> — not self-reported.</span>
        </div>

        {/* YouTube section */}
        {ytPlatform && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                  <IconYoutube size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{ytPlatform.platform_username}</p>
                  {ytMeta?.handle && <p className="text-xs text-gray-500">{ytMeta.handle}</p>}
                </div>
              </div>
              <a
                href={`https://youtube.com/channel/${ytPlatform.platform_user_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <IconExternal size={12} /> View on YouTube
              </a>
            </div>

            {/* Visible metrics grid */}
            {(mv.subscribers || mv.total_views || mv.video_count || mv.avg_views) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {mv.subscribers && ytMeta?.subscribers !== undefined && (
                  <MetricPill icon={IconUsers} label="Subscribers" value={fmt(ytMeta.subscribers)} />
                )}
                {mv.total_views && ytMeta?.totalViews !== undefined && (
                  <MetricPill icon={IconEye} label="Total Views" value={fmt(ytMeta.totalViews)} />
                )}
                {mv.video_count && ytMeta?.videoCount !== undefined && (
                  <MetricPill icon={IconVideo} label="Videos" value={fmt(ytMeta.videoCount)} />
                )}
                {mv.avg_views && ytMeta?.subscribers !== undefined && ytMeta?.totalViews !== undefined && ytMeta?.videoCount !== undefined && (
                  <MetricPill icon={IconTrendUp} label="Avg Views/Video"
                    value={fmt(Math.round((ytMeta.totalViews ?? 0) / Math.max(ytMeta.videoCount ?? 1, 1)))} />
                )}
              </div>
            )}

            {/* No metrics shown notice */}
            {!mv.subscribers && !mv.total_views && !mv.video_count && !mv.avg_views && (
              <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center">
                <p className="text-sm text-gray-400">Creator has chosen not to share detailed metrics publicly.</p>
              </div>
            )}
          </div>
        )}

        {/* Instagram section */}
        {igPlatform && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)" }}>
                  <IconInstagram size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{igPlatform.platform_username}</p>
                  {igMeta?.username && <p className="text-xs text-gray-500">@{igMeta.username}</p>}
                </div>
              </div>
              {igMeta?.username && (
                <a href={`https://instagram.com/${igMeta.username}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                  <IconExternal size={12} /> View on Instagram
                </a>
              )}
            </div>

            {mv.subscribers && igMeta?.followers_count !== undefined && (
              <div className="grid grid-cols-2 gap-3">
                <MetricPill icon={IconUsers} label="Followers" value={fmt(igMeta.followers_count)} />
                {igMeta.media_count !== undefined && (
                  <MetricPill icon={IconVideo} label="Posts" value={fmt(igMeta.media_count)} />
                )}
              </div>
            )}
          </div>
        )}

        {!hasAnyPlatform && (
          <div className="card p-6 mb-6 border-dashed border-2 border-gray-200 text-center">
            <p className="text-gray-400 text-sm">No platforms connected yet.</p>
          </div>
        )}

        {/* About */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">About this creator</h2>
          <div>
            {profile?.creator_stage && (
              <BadgeRow label="Creator stage" value={stageLabels[profile.creator_stage] ?? profile.creator_stage} />
            )}
            {profile?.aspiration && (
              <BadgeRow label="Aspiration" value={profile.aspiration.replace(/_/g, " ")} />
            )}
            {ytPlatform && <BadgeRow label="Verified on" value="YouTube" />}
            {igPlatform && <BadgeRow label="Verified on" value="Instagram" />}
            <BadgeRow label="Profile powered by" value="Tether — verified creator metrics" />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">
            This profile is powered by{" "}
            <a href="/" className="text-brand-600 font-medium">Tether</a>{" "}
            — the verified creator intelligence platform.
          </p>
          <a href="/signup" className="inline-block mt-3 btn-primary text-sm">
            Create your verified profile →
          </a>
        </div>
      </main>
    </div>
  );
}
