"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { api, BusinessProfile } from "@/lib/api";
import Sidebar from "@/components/layout/Sidebar";
import {
  IconSearch, IconBriefcase, IconMessage, IconExternal,
} from "@/components/ui/Icons";

const INDUSTRIES = [
  "Gaming", "Tech & Science", "Education", "Lifestyle",
  "Beauty & Fashion", "Food & Cooking", "Travel", "Fitness & Health",
  "Business & Finance", "Comedy & Entertainment", "Music",
  "Art & Design", "Sports", "Kids & Family", "DIY & How-to",
  "News & Politics", "Other",
];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200/70 rounded-xl ${className}`} />;
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
        active ? "bg-brand-50 text-brand-700 font-semibold" : "text-gray-600 hover:bg-gray-100"
      }`}>
      {label}
    </button>
  );
}

function BusinessCard({ biz, onMessage }: { biz: BusinessProfile; onMessage: (id: string) => void }) {
  const [messaging, setMessaging] = useState(false);
  const displayName = biz.company_name ?? biz.full_name ?? biz.username ?? "Business";
  const initial = displayName[0]?.toUpperCase() ?? "B";

  async function handleMessage() {
    setMessaging(true);
    await onMessage(biz.id);
    setMessaging(false);
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shrink-0 text-white font-bold text-base">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
          {biz.username && <p className="text-xs text-gray-400">@{biz.username}</p>}
          {biz.category && (
            <span className="mt-1 inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              {biz.category}
            </span>
          )}
        </div>
      </div>

      {biz.bio && (
        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{biz.bio}</p>
      )}

      {biz.website && (
        <a href={biz.website} target="_blank" rel="noopener noreferrer"
          className="text-xs text-brand-600 hover:text-brand-700 truncate flex items-center gap-1">
          <IconExternal size={10} />
          {biz.website.replace(/^https?:\/\//, "")}
        </a>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button onClick={handleMessage} disabled={messaging}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 transition-all">
          <IconMessage size={11} />
          {messaging ? "Opening…" : "Message"}
        </button>
      </div>
    </div>
  );
}

export default function BusinessesPage() {
  const [email, setEmail]           = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [total, setTotal]           = useState(0);
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [searching, setSearching]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = "/login"; return; }

    try {
      const { profile, email: em } = await api.profile.get();
      setEmail(em ?? user.email ?? "");
      setDisplayName(profile.full_name ?? profile.username ?? "");
    } catch { setEmail(user.email ?? ""); }

    try {
      const res = await api.businesses.search({ limit: 20 });
      setBusinesses(res.businesses);
      setTotal(res.total);
    } catch { /* non-fatal */ }

    setPageLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.businesses.search({ q: search.trim(), category, limit: 20 });
        setBusinesses(res.businesses);
        setTotal(res.total);
      } catch { /* non-fatal */ } finally {
        setSearching(false);
      }
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  async function handleMessage(businessId: string) {
    try {
      const { conversation } = await api.conversations.start(businessId);
      window.location.href = `/messages?c=${conversation.id}`;
    } catch { window.location.href = "/messages"; }
  }

  return (
    <div className="flex h-screen bg-[#f5f0e8] overflow-hidden">
      <Sidebar email={email} displayName={displayName || undefined} userType="creator" />

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="bg-white/70 backdrop-blur-sm border-b border-white/80 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <IconBriefcase size={15} className="text-brand-600" />
            <h1 className="text-sm font-bold text-gray-900">Businesses</h1>
            <span className="text-xs text-gray-400">Find brands to collaborate with</span>
          </div>
          <div className="relative mt-3 max-w-lg">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by company name or description…"
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

        <div className="flex-1 overflow-hidden flex">
          {/* Filter sidebar */}
          <aside className="w-52 shrink-0 h-full overflow-y-auto bg-white/50 border-r border-white/80 px-4 py-5 space-y-5">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Industry</p>
              <div className="space-y-0.5">
                <FilterPill label="All industries" active={!category} onClick={() => setCategory("")} />
                {INDUSTRIES.map(ind => (
                  <FilterPill key={ind} label={ind}
                    active={category === ind}
                    onClick={() => setCategory(category === ind ? "" : ind)} />
                ))}
              </div>
            </div>
            {category && (
              <button onClick={() => setCategory("")}
                className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-1.5 rounded-lg hover:bg-red-50 transition-all">
                Clear filter
              </button>
            )}
          </aside>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {pageLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : businesses.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-dashed border-gray-200 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3">
                  <IconBriefcase size={20} className="text-blue-400" />
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">No businesses found</p>
                <p className="text-xs text-gray-400">Try a different search or check back later.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4">{total} business{total !== 1 ? "es" : ""} found</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {businesses.map(b => (
                    <BusinessCard key={b.id} biz={b} onMessage={handleMessage} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
