"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { api, SavedCreator, CreatorResponse } from "@/lib/api";
import { fmt, timeAgo } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconBookmarkFilled, IconExternal, IconYoutube, IconUsers, IconEye,
  IconVideo, IconAlert, IconSearch, IconTrendUp,
} from "@/components/ui/Icons";

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-xl ${className}`} />;
}

interface EnrichedCreator extends SavedCreator {
  profile?: CreatorResponse["profile"];
  ytChannel?: CreatorResponse["snapshots"]["youtube"]["data"]["channel"];
  ytPlatform?: CreatorResponse["platforms"][0];
  loading: boolean;
  error?: string;
}

export default function DashboardPage() {
  const [email, setEmail]   = useState("");
  const [name, setName]     = useState("");
  const [saved, setSaved]   = useState<EnrichedCreator[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    try {
      const { profile, email: em } = await api.profile.get();
      setEmail(em ?? user.email ?? "");
      setName(profile.full_name ?? "");
      // Ensure user_type is set to business
      if (!profile.user_type || profile.user_type !== "business") {
        await api.profile.update({ user_type: "business" });
      }
    } catch { setEmail(user.email ?? ""); }

    try {
      const { saved: list } = await api.saved.list();
      const enriched: EnrichedCreator[] = list.map(s => ({ ...s, loading: true }));
      setSaved(enriched);
      setPageLoading(false);

      // Enrich each saved creator with their public profile data
      const enriched2 = await Promise.all(
        list.map(async (s): Promise<EnrichedCreator> => {
          try {
            const data = await api.creators.get(s.creator_username);
            const ytSnap = data.snapshots["youtube"];
            return {
              ...s,
              profile: data.profile,
              ytChannel: ytSnap?.data?.channel,
              ytPlatform: data.platforms.find(p => p.platform === "youtube"),
              loading: false,
            };
          } catch (err) {
            return { ...s, loading: false, error: err instanceof Error ? err.message : "Failed to load" };
          }
        })
      );
      setSaved(enriched2);
    } catch {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function unsave(username: string) {
    setSaved(s => s.filter(c => c.creator_username !== username));
    await api.saved.unsave(username).catch(() => {});
  }

  const allCategories = Array.from(new Set(saved.map(c => c.profile?.category).filter(Boolean))) as string[];

  const filtered = saved.filter(c => {
    if (search && !c.creator_username.includes(search.toLowerCase()) &&
        !(c.profile?.full_name ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryFilter && c.profile?.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={email} name={name} />

      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 className="text-base font-bold text-gray-900">Saved Creators</h1>
            <p className="text-xs text-gray-400 mt-0.5">Your shortlist of verified creators</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search saved creators…"
                className="input pl-9 py-2 text-xs"
              />
            </div>
            {allCategories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="input py-2 text-xs w-44"
              >
                <option value="">All categories</option>
                {allCategories.sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>
        </header>

        <div className="p-8 max-w-5xl space-y-4">
          {pageLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-dashed border-gray-200 text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-4">
                <IconBookmarkFilled size={22} className="text-brand-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                {search ? "No results match your search" : "No saved creators yet"}
              </h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {search ? "Try a different name." : "Browse a creator's public profile and click Save to add them here."}
              </p>
            </div>
          ) : (
            filtered.map(c => (
              <CreatorCard key={c.creator_username} creator={c} onUnsave={unsave} />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function CreatorCard({ creator: c, onUnsave }: { creator: EnrichedCreator; onUnsave: (u: string) => void }) {
  const ch = c.ytChannel;
  const avgViews = ch ? Math.round(ch.totalViews / Math.max(ch.videoCount, 1)) : 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white text-xl font-bold">
          {c.loading ? (
            <div className="w-full h-full rounded-2xl bg-gray-200 animate-pulse" />
          ) : (
            (c.profile?.full_name?.[0] ?? c.creator_username?.[0] ?? "?").toUpperCase()
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {c.loading ? (
            <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-24" /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-gray-900">{c.profile?.full_name ?? `@${c.creator_username}`}</p>
                {c.ytPlatform && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-100"><IconYoutube size={9} /> YouTube</span>}
                {c.profile?.category && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                    {c.profile.category}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">@{c.creator_username}</p>
              {c.profile?.bio && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{c.profile.bio}</p>}
            </>
          )}
        </div>

        {/* Stats */}
        {ch && !c.loading && (
          <div className="hidden sm:flex items-center gap-5 shrink-0">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt(ch.subscribers)}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><IconUsers size={9} /> Subs</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt(ch.totalViews)}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><IconEye size={9} /> Views</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt(avgViews)}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><IconTrendUp size={9} /> Avg</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt(ch.videoCount)}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-0.5"><IconVideo size={9} /> Videos</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <a href={`${process.env.NEXT_PUBLIC_CREATOR_URL ?? "https://tether-frontend.vercel.app"}/c/${c.creator_username}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
            <IconExternal size={11} /> View
          </a>
          <button onClick={() => onUnsave(c.creator_username)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-red-100 bg-red-50 hover:bg-red-100 text-red-600">
            <IconBookmarkFilled size={11} /> Unsave
          </button>
        </div>
      </div>

      {c.error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
          <IconAlert size={12} /> Could not load metrics: {c.error}
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <p className="text-[10px] text-gray-300">Saved {timeAgo(c.saved_at)}</p>
        {c.profile?.updated_at && (
          <p className="text-[10px] text-gray-300">Profile updated {timeAgo(c.profile.updated_at)}</p>
        )}
      </div>
    </div>
  );
}
