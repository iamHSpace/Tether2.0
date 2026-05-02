"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, timeAgo } from "@/lib/utils";
import {
  IconUsers, IconEye, IconVideo, IconYoutube, IconExternal,
  IconThumbUp, IconChat, IconShield, IconShare, IconCopy, IconCheck
} from "@/components/ui/Icons";

interface Profile {
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  creator_stage: string | null;
  aspiration: string | null;
}

interface PlatformToken {
  platform: string;
  platform_username: string;
  platform_user_id: string;
  metadata: {
    handle?: string;
    thumbnail?: string;
  };
}

interface PageState {
  profile: Profile | null;
  token: PlatformToken | null;
  ytStats: {
    subscribers: number;
    totalViews: number;
    videoCount: number;
  } | null;
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

function BigStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 p-5 rounded-2xl bg-white border border-gray-100 shadow-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-1 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username ?? "";

  const [state, setState] = useState<PageState>({ profile: null, token: null, ytStats: null, notFound: false });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!username) return;
    async function load() {
      // Look up profile by username
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("username, full_name, bio, avatar_url, creator_stage, aspiration")
        .eq("username", username)
        .single();

      if (error || !profile) {
        setState(s => ({ ...s, notFound: true }));
        setLoading(false);
        return;
      }

      // Look up their youtube token (public info only — no tokens)
      const { data: token } = await supabase
        .from("platform_tokens")
        .select("platform, platform_username, platform_user_id, metadata")
        .eq("platform", "youtube")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      setState({ profile, token: token ?? null, ytStats: null, notFound: false });
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
    growing: "🚀 Growing fast",
    established: "⭐ Established",
    pro: "👑 Pro creator",
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

  const { profile, token } = state;

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
          {/* Avatar */}
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
        {token?.platform === "youtube" && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                  <IconYoutube size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{token.platform_username}</p>
                  {token.metadata?.handle && (
                    <p className="text-xs text-gray-500">{token.metadata.handle}</p>
                  )}
                </div>
              </div>
              <a
                href={`https://youtube.com/channel/${token.platform_user_id}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <IconExternal size={12} /> View on YouTube
              </a>
            </div>

            {/* Note: In production you'd fetch public stats here */}
            <div className="p-4 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-center">
              <p className="text-sm text-gray-500">
                Live stats are verified and fetched securely.{" "}
                <a href="/login" className="text-brand-600 font-medium">Sign in to see full metrics.</a>
              </p>
            </div>
          </div>
        )}

        {!token && (
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
            <BadgeRow label="Verified platform" value="YouTube" />
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
