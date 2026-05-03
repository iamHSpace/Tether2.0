"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api, YouTubeStatsResponse } from "@/lib/api";
import { fmt, timeAgo, cn } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconUsers, IconEye, IconVideo, IconTrendUp, IconYoutube,
  IconRefresh, IconExternal, IconThumbUp, IconChat,
  IconCopy, IconCheck, IconBell
} from "@/components/ui/Icons";

interface DashboardProfile { username: string | null; email: string; }

// ── Sparkline (pure SVG, no recharts) ────────────────────────────────────────

function Sparkline({ data, color = "#7c3aed" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
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
  label: string; value: string; Icon: React.ElementType;
  color: string; trend?: string;
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [profile, setProfile]   = useState<DashboardProfile | null>(null);
  const [ytData, setYtData]     = useState<YouTubeStatsResponse | null>(null);
  const [ytError, setYtError]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);

  useEffect(() => {
    async function load() {
      // Verify there is an active session
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = "/login"; return; }

      try {
        // Load profile via backend API (no direct DB call)
        const { profile: prof, email } = await api.profile.get();
        setProfile({ username: prof.username, email: email ?? user.email ?? "" });
      } catch {
        setProfile({ username: null, email: user.email ?? "" });
      }

      try { setYtData(await api.youtube.stats()); }
      catch (err) { setYtError(err instanceof Error ? err.message : String(err)); }
      setLoading(false);
    }
    load();
  }, []);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/${profile?.username ?? "me"}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const viewsData = ytData?.videos.map(v => v.views) ?? [];
  const likesData  = ytData?.videos.map(v => v.likes) ?? [];

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

        <div className="p-8 space-y-6">

          {/* YouTube connect prompt */}
          {!loading && !ytData && (
            <div className="card p-6 flex items-center justify-between border-dashed border-2 border-red-100 bg-gradient-to-r from-red-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center">
                  <IconYoutube size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Connect YouTube</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Link your channel to see live verified metrics.</p>
                  {ytError && !ytError.includes("not connected") && (
                    <p className="text-xs text-red-500 mt-1">{ytError}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => api.youtube.connect()}
                className="btn-primary text-sm flex items-center gap-2 shrink-0">
                <IconYoutube size={15} className="text-white" /> Connect YouTube
              </button>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="card p-5 h-28 animate-pulse bg-gray-100/60" />
              ))}
            </div>
          )}

          {ytData && (
            <>
              {/* Channel card */}
              <div className="card p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {ytData.channel.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ytData.channel.thumbnail} alt={ytData.channel.name}
                      width={52} height={52} className="rounded-full ring-2 ring-brand-100" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{ytData.channel.name}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        ✓ Verified
                      </span>
                    </div>
                    {ytData.channel.handle && <p className="text-sm text-gray-500">{ytData.channel.handle}</p>}
                    <p className="text-xs text-gray-400">Connected {timeAgo(ytData.connectedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => api.youtube.connect()}
                    className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
                    <IconRefresh size={12} /> Reconnect
                  </button>
                  <a href={`https://youtube.com/channel/${ytData.channel.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3">
                    <IconExternal size={12} /> YouTube
                  </a>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <StatCard label="Subscribers"     value={fmt(ytData.channel.subscribers)} Icon={IconUsers}   color="bg-brand-500" />
                <StatCard label="Total Views"     value={fmt(ytData.channel.totalViews)}  Icon={IconEye}     color="bg-blue-500"  />
                <StatCard label="Videos"          value={fmt(ytData.channel.videoCount)}  Icon={IconVideo}   color="bg-green-500" />
                <StatCard label="Avg Views/Video" Icon={IconTrendUp} color="bg-orange-400"
                  value={fmt(Math.round(ytData.channel.totalViews / (ytData.channel.videoCount || 1)))} />
              </div>

              {/* Charts + recent videos */}
              <div className="grid grid-cols-5 gap-4">
                {/* Sparkline chart */}
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

                {/* Recent videos */}
                <div className="card p-5 col-span-2">
                  <h3 className="font-semibold text-gray-900 text-sm mb-4">Recent Videos</h3>
                  <div className="space-y-3.5">
                    {ytData.videos.map(v => (
                      <div key={v.id} className="flex gap-3 items-start group">
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

              {/* Share CTA */}
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
                    <a href={`/${profile.username}`} target="_blank"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-all">
                      <IconExternal size={14} /> View profile
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
