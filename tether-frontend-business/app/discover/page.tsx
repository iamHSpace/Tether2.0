"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { api, DiscoverCreator, SavedCreator } from "@/lib/api";
import { fmt } from "@/lib/utils";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconSearch, IconUsers, IconEye, IconVideo, IconCompass, IconStar,
  IconBookmark, IconBookmarkFilled, IconExternal, IconTrendUp, IconCheck,
} from "@/components/ui/Icons";
import { timeAgo } from "@/lib/utils";

// ── Filter definitions ────────────────────────────────────────────────────────

const CATEGORIES = [
  "Gaming", "Tech & Science", "Education", "Lifestyle", "Vlog",
  "Beauty & Fashion", "Food & Cooking", "Travel", "Fitness & Health",
  "Business & Finance", "Comedy & Entertainment", "Music",
  "Art & Design", "Sports", "Kids & Family", "DIY & How-to",
  "News & Politics", "Other",
];

type SubRange = { label: string; min?: number; max?: number };
const SUB_RANGES: SubRange[] = [
  { label: "Any" },
  { label: "Nano · 1K–10K",      min: 1_000,     max: 10_000    },
  { label: "Micro · 10K–100K",   min: 10_000,    max: 100_000   },
  { label: "Mid · 100K–500K",    min: 100_000,   max: 500_000   },
  { label: "Macro · 500K–1M",    min: 500_000,   max: 1_000_000 },
  { label: "Mega · 1M+",         min: 1_000_000                 },
];

type AvgRange = { label: string; min?: number; max?: number };
const AVG_RANGES: AvgRange[] = [
  { label: "Any" },
  { label: "< 1K",       max: 1_000    },
  { label: "1K – 10K",   min: 1_000,   max: 10_000  },
  { label: "10K – 100K", min: 10_000,  max: 100_000 },
  { label: "100K+",      min: 100_000               },
];

type VidRange = { label: string; min?: number; max?: number };
const VID_RANGES: VidRange[] = [
  { label: "Any" },
  { label: "< 20",       max: 20  },
  { label: "20 – 100",   min: 20,  max: 100 },
  { label: "100 – 500",  min: 100, max: 500 },
  { label: "500+",       min: 500             },
];

const STAGES = [
  { label: "Any",             value: ""                },
  { label: "Just Starting",   value: "just_starting"   },
  { label: "Growing",         value: "growing"         },
  { label: "Established",     value: "established"     },
];

const SORT_OPTIONS = [
  { label: "Subscribers",  value: "subscribers"  },
  { label: "Avg Views",    value: "avg_views"    },
  { label: "Total Views",  value: "total_views"  },
  { label: "Video Count",  value: "video_count"  },
];

// ── Filter state type ─────────────────────────────────────────────────────────

interface Filters {
  category:      string;
  subRange:      number; // index into SUB_RANGES
  avgRange:      number; // index into AVG_RANGES
  vidRange:      number; // index into VID_RANGES
  stage:         number; // index into STAGES
  sortBy:        string;
}

const DEFAULT_FILTERS: Filters = {
  category: "", subRange: 0, avgRange: 0, vidRange: 0, stage: 0, sortBy: "subscribers",
};

function activeFilterCount(f: Filters) {
  return (f.category ? 1 : 0) + (f.subRange ? 1 : 0) + (f.avgRange ? 1 : 0) +
         (f.vidRange ? 1 : 0) + (f.stage ? 1 : 0);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-xl ${className}`} />;
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
        active ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {label}
      {active && <IconCheck size={11} className="text-brand-600 shrink-0" />}
    </button>
  );
}

// ── Creator card ──────────────────────────────────────────────────────────────

interface CreatorCardProps {
  creator: DiscoverCreator;
  isSaved: boolean;
  onSave: (u: string) => void;
  onUnsave: (u: string) => void;
}

function CreatorCard({ creator: c, isSaved, onSave, onUnsave }: CreatorCardProps) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    if (isSaved) await onUnsave(c.username); else await onSave(c.username);
    setBusy(false);
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex flex-col gap-3">
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

      {c.bio && <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{c.bio}</p>}

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-xl py-2 text-center">
          <p className="text-sm font-bold text-gray-900">{fmt(c.subscribers)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5"><IconUsers size={9} /> Subscribers</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2 text-center">
          <p className="text-sm font-bold text-gray-900">{fmt(c.avg_views)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5"><IconTrendUp size={9} /> Avg Views</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2 text-center">
          <p className="text-sm font-bold text-gray-900">{fmt(c.total_views)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5"><IconEye size={9} /> Total Views</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2 text-center">
          <p className="text-sm font-bold text-gray-900">{fmt(c.video_count)}</p>
          <p className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5 mt-0.5"><IconVideo size={9} /> Videos</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button onClick={toggle} disabled={busy}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
            isSaved
              ? "bg-brand-50 text-brand-700 border border-brand-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
              : "bg-brand-600 text-white hover:bg-brand-700"
          }`}>
          {isSaved ? <IconBookmarkFilled size={11} /> : <IconBookmark size={11} />}
          {busy ? "…" : isSaved ? "Saved" : "Save creator"}
        </button>
        <a href={`/c/${c.username}`}
          className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-600">
          <IconExternal size={11} /> View
        </a>
      </div>

      {c.updated_at && (
        <p className="text-[10px] text-gray-300 -mt-1">Updated {timeAgo(c.updated_at)}</p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DiscoverPage() {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");

  const [search, setSearch]               = useState("");
  const [filters, setFilters]             = useState<Filters>(DEFAULT_FILTERS);
  const [creators, setCreators]           = useState<DiscoverCreator[]>([]);
  const [recommended, setRecommended]     = useState<DiscoverCreator[]>([]);
  const [savedUsernames, setSaved]        = useState<Set<string>>(new Set());
  const [pageLoading, setPageLoading]     = useState(true);
  const [searching, setSearching]         = useState(false);
  const [total, setTotal]                 = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFilters = search.trim().length > 0 || activeFilterCount(filters) > 0;

  function buildParams() {
    const sub = SUB_RANGES[filters.subRange];
    const avg = AVG_RANGES[filters.avgRange];
    const vid = VID_RANGES[filters.vidRange];
    return {
      q:             search.trim(),
      category:      filters.category,
      creator_stage: STAGES[filters.stage].value,
      sort_by:       filters.sortBy,
      min_subs:      sub.min,
      max_subs:      sub.max,
      min_avg_views: avg.min,
      max_avg_views: avg.max,
      min_videos:    vid.min,
      max_videos:    vid.max,
      limit:         30,
    };
  }

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
        api.discover.search({ limit: 6, sort_by: "subscribers" }),
        api.saved.list(),
      ]);
      setRecommended(discoverRes.creators);
      setSaved(new Set(savedRes.saved.map((s: SavedCreator) => s.creator_username)));
    } catch { /* non-fatal */ }

    setPageLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch whenever search or filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasFilters) {
      setCreators([]);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.discover.search(buildParams());
        setCreators(res.creators);
        setTotal(res.total);
      } catch { /* non-fatal */ } finally {
        setSearching(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters]);

  async function handleSave(username: string) {
    await api.saved.save(username).catch(() => {});
    setSaved(s => new Set([...s, username]));
  }
  async function handleUnsave(username: string) {
    await api.saved.unsave(username).catch(() => {});
    setSaved(s => { const n = new Set(s); n.delete(username); return n; });
  }

  function setFilter<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  const displayCreators = hasFilters ? creators : recommended;
  const filterCount = activeFilterCount(filters);

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={email} name={name} />

      <main className="flex-1 overflow-hidden flex flex-col">
        {/* ── Top bar ── */}
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <IconCompass size={15} className="text-brand-600" />
            <h1 className="text-sm font-bold text-gray-900">Discover Creators</h1>
          </div>
          <div className="relative mt-3 max-w-lg">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or username…"
              className="input pl-9 py-2 text-sm w-full"
              autoComplete="off"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                <span className="w-3.5 h-3.5 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin inline-block" />
              </span>
            )}
          </div>
        </header>

        {/* ── Body: filter panel + results ── */}
        <div className="flex-1 overflow-hidden flex">

          {/* Filter panel */}
          <aside className="w-52 shrink-0 h-full overflow-y-auto bg-white/50 border-r border-white/80 px-4 py-5 space-y-5">

            {/* Sort */}
            <FilterSection title="Sort by">
              <div className="space-y-0.5">
                {SORT_OPTIONS.map(o => (
                  <FilterPill key={o.value} label={o.label}
                    active={filters.sortBy === o.value}
                    onClick={() => setFilter("sortBy", o.value)} />
                ))}
              </div>
            </FilterSection>

            {/* Category */}
            <FilterSection title="Category">
              <div className="space-y-0.5">
                <FilterPill label="All categories" active={!filters.category} onClick={() => setFilter("category", "")} />
                {CATEGORIES.map(c => (
                  <FilterPill key={c} label={c}
                    active={filters.category === c}
                    onClick={() => setFilter("category", filters.category === c ? "" : c)} />
                ))}
              </div>
            </FilterSection>

            {/* Subscribers */}
            <FilterSection title="Subscribers">
              <div className="space-y-0.5">
                {SUB_RANGES.map((r, i) => (
                  <FilterPill key={i} label={r.label}
                    active={filters.subRange === i}
                    onClick={() => setFilter("subRange", i)} />
                ))}
              </div>
            </FilterSection>

            {/* Avg views */}
            <FilterSection title="Avg Views / Video">
              <div className="space-y-0.5">
                {AVG_RANGES.map((r, i) => (
                  <FilterPill key={i} label={r.label}
                    active={filters.avgRange === i}
                    onClick={() => setFilter("avgRange", i)} />
                ))}
              </div>
            </FilterSection>

            {/* Video count */}
            <FilterSection title="Video Count">
              <div className="space-y-0.5">
                {VID_RANGES.map((r, i) => (
                  <FilterPill key={i} label={r.label}
                    active={filters.vidRange === i}
                    onClick={() => setFilter("vidRange", i)} />
                ))}
              </div>
            </FilterSection>

            {/* Creator stage */}
            <FilterSection title="Creator Stage">
              <div className="space-y-0.5">
                {STAGES.map((s, i) => (
                  <FilterPill key={i} label={s.label}
                    active={filters.stage === i}
                    onClick={() => setFilter("stage", i)} />
                ))}
              </div>
            </FilterSection>

            {/* Reset */}
            {filterCount > 0 && (
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-all">
                Clear {filterCount} filter{filterCount !== 1 ? "s" : ""}
              </button>
            )}
          </aside>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {pageLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
              </div>
            ) : (
              <>
                {/* Section label */}
                <div className="flex items-center gap-2 mb-4">
                  {hasFilters ? (
                    <>
                      <IconSearch size={13} className="text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">
                        {searching ? "Searching…" : `${total} creator${total !== 1 ? "s" : ""} found`}
                      </span>
                    </>
                  ) : (
                    <>
                      <IconStar size={13} className="text-amber-500" />
                      <span className="text-sm font-semibold text-gray-700">Recommended</span>
                      <span className="text-[10px] text-gray-400">Top creators by subscribers</span>
                    </>
                  )}
                </div>

                {displayCreators.length === 0 && !searching ? (
                  <div className="bg-white rounded-2xl p-12 border border-dashed border-gray-200 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto mb-3">
                      <IconCompass size={20} className="text-brand-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">No creators match these filters</p>
                    <p className="text-xs text-gray-400">Try adjusting your filters or search term.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {displayCreators.map(c => (
                      <CreatorCard key={c.id} creator={c}
                        isSaved={savedUsernames.has(c.username)}
                        onSave={handleSave} onUnsave={handleUnsave} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
