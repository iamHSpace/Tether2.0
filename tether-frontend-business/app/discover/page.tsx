"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { api, DiscoverCreator, SavedCreator } from "@/lib/api";
import { fmt } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconSearch, IconUsers, IconEye, IconVideo, IconCompass, IconStar,
  IconBookmark, IconBookmarkFilled, IconExternal, IconYoutube,
} from "@/components/ui/Icons";

const CATEGORIES = [
  "Gaming", "Tech & Science", "Education", "Lifestyle", "Vlog",
  "Beauty & Fashion", "Food & Cooking", "Travel", "Fitness & Health",
  "Business & Finance", "Comedy & Entertainment", "Music",
  "Art & Design", "Sports", "Kids & Family", "DIY & How-to",
  "News & Politics", "Other",
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-xl ${className}`} />;
}

interface CreatorCardProps {
  creator: DiscoverCreator;
  isSaved: boolean;
  onSave: (username: string) => void;
  onUnsave: (username: string) => void;
}

function CreatorCard({ creator: c, isSaved, onSave, onUnsave }: CreatorCardProps) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    if (isSaved) await onUnsave(c.username);
    else await onSave(c.username);
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-purple-600 flex items-center justify-center shrink-0 text-white font-bold text-base">
          {(c.full_name?.[0] ?? c.username?.[0] ?? "?").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{c.full_name ?? `@${c.username}`}</p>
          <p className="text-xs text-gray-400">@{c.username}</p>
          {c.category && (
            <span className="mt-1 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
              {c.category}
            </span>
          )}
        </div>
      </div>

      {/* Bio */}
      {c.bio && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{c.bio}</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-sm font-bold text-gray-900">{fmt(c.subscribers)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
            <IconUsers size={9} /> Subs
          </p>
        </div>
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-sm font-bold text-gray-900">{fmt(c.total_views)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
            <IconEye size={9} /> Views
          </p>
        </div>
        <div className="text-center bg-gray-50 rounded-xl py-2">
          <p className="text-sm font-bold text-gray-900">{fmt(c.video_count)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5">
            <IconVideo size={9} /> Videos
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={toggle}
          disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            isSaved
              ? "bg-brand-50 text-brand-700 border border-brand-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}
        >
          {isSaved ? <IconBookmarkFilled size={11} /> : <IconBookmark size={11} />}
          {busy ? "…" : isSaved ? "Saved" : "Save creator"}
        </button>
        <a
          href={`/c/${c.username}`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600"
        >
          <IconExternal size={11} /> View
        </a>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");

  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("");
  const [creators, setCreators]     = useState<DiscoverCreator[]>([]);
  const [recommended, setRecommended] = useState<DiscoverCreator[]>([]);
  const [savedUsernames, setSavedUsernames] = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [searching, setSearching]   = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearching = search.trim().length > 0 || category.length > 0;

  // Load user info + recommended + saved list on mount
  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    try {
      const { profile, email: em } = await api.profile.get();
      setEmail(em ?? user.email ?? "");
      setName(profile.full_name ?? "");
    } catch { setEmail(user.email ?? ""); }

    try {
      const [discoverRes, savedRes] = await Promise.all([
        api.discover.search({ limit: 6 }),
        api.saved.list(),
      ]);
      setRecommended(discoverRes.creators);
      setSavedUsernames(new Set(savedRes.saved.map((s: SavedCreator) => s.creator_username)));
    } catch { /* non-fatal */ }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!search.trim() && !category) {
      setCreators([]);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.discover.search({ q: search.trim(), category, limit: 30 });
        setCreators(res.creators);
      } catch { /* non-fatal */ } finally {
        setSearching(false);
      }
    }, 350);
  }, [search, category]);

  async function handleSave(username: string) {
    await api.saved.save(username).catch(() => {});
    setSavedUsernames(s => new Set([...s, username]));
  }

  async function handleUnsave(username: string) {
    await api.saved.unsave(username).catch(() => {});
    setSavedUsernames(s => { const n = new Set(s); n.delete(username); return n; });
  }

  const displayCreators = isSearching ? creators : recommended;

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={email} name={name} />

      <main className="flex-1 overflow-y-auto">
        {/* Header */}
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-8 py-5 sticky top-0 z-10">
          <div className="max-w-5xl">
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <IconCompass size={16} className="text-brand-600" /> Discover Creators
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Search and find verified creators across every niche</p>

            {/* Search bar */}
            <div className="relative mt-4">
              <IconSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or username…"
                className="input pl-10 py-2.5 text-sm w-full max-w-lg"
                autoComplete="off"
              />
              {searching && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2">
                  <span className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin inline-block" />
                </span>
              )}
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              <button
                onClick={() => setCategory("")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  !category ? "bg-brand-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-brand-300"
                }`}
              >
                All
              </button>
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(cat => cat === c ? "" : c)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    category === c ? "bg-purple-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-purple-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="p-8 max-w-5xl">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
            </div>
          ) : (
            <>
              {/* Section heading */}
              <div className="flex items-center gap-2 mb-4">
                {isSearching ? (
                  <>
                    <IconSearch size={14} className="text-gray-400" />
                    <h2 className="text-sm font-semibold text-gray-700">
                      {searching ? "Searching…" : `${creators.length} result${creators.length !== 1 ? "s" : ""}`}
                    </h2>
                  </>
                ) : (
                  <>
                    <IconStar size={14} className="text-amber-500" />
                    <h2 className="text-sm font-semibold text-gray-700">Recommended Creators</h2>
                    <span className="text-[10px] text-gray-400 font-normal">Top verified creators by subscribers</span>
                  </>
                )}
              </div>

              {/* Grid */}
              {displayCreators.length === 0 && !searching ? (
                <div className="bg-white rounded-2xl p-12 border border-dashed border-gray-200 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-3">
                    <IconCompass size={20} className="text-brand-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">No creators found</p>
                  <p className="text-xs text-gray-400">Try a different search term or category.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {displayCreators.map(c => (
                    <CreatorCard
                      key={c.id}
                      creator={c}
                      isSaved={savedUsernames.has(c.username)}
                      onSave={handleSave}
                      onUnsave={handleUnsave}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
