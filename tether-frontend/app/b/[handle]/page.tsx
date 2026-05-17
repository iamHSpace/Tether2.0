import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { timeAgo } from "@/lib/utils";
import type { Profile } from "@/lib/api";
import { IconExternal, IconShield } from "@/components/ui/Icons";

export const revalidate = 300;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://statvora.in";

interface ProfileData {
  profile: Profile;
  platforms: unknown[];
  snapshots: Record<string, unknown>;
}

async function getProfile(username: string): Promise<ProfileData | null> {
  const res = await fetch(`${BACKEND}/api/creators/${encodeURIComponent(username)}`, {
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

function resolveHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  return decoded.slice(1);
}

// ── SEO metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> }
): Promise<Metadata> {
  const { handle } = await params;
  const username = resolveHandle(handle);
  if (!username) return { title: "Not found" };

  const data = await getProfile(username).catch(() => null);
  if (!data) return { title: "Brand not found" };

  const { profile } = data;
  const name = profile.company_name ?? profile.full_name ?? `@${profile.username}`;
  const ogTitle = `${name} — Brand profile on Statvora`;
  const description = profile.bio
    ? `${profile.bio} — Discover and connect with verified creators on Statvora.`
    : `${name} is looking for verified creators on Statvora — the creator intelligence platform.`;

  const pageUrl = `${APP_URL}/b/@${username}`;

  return {
    title: ogTitle,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "profile",
      siteName: "Statvora",
      title: ogTitle,
      description,
      url: pageUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
    },
  };
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function BusinessPublicProfile(
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;

  const username = resolveHandle(handle);
  if (!username) return notFound();

  const data = await getProfile(username);
  if (!data) return notFound();

  const { profile } = data;

  // ── Type guard: creator profiles live at /@username ────────────────────────
  if (profile.user_type === "creator") {
    redirect(`/@${username}`);
  }

  const name = profile.company_name ?? profile.full_name ?? `@${profile.username}`;
  const initials = (name[0] ?? "?").toUpperCase();

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      {/* Nav */}
      <nav className="bg-white/70 backdrop-blur-sm border-b border-white/80 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
              <img src="/brand/logo-icon.svg" width={12} height={12} alt="Statvora" />
            </div>
            <span className="text-sm font-bold text-gray-800">Statvora</span>
          </a>
          <a href="/signup"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-brand-600 text-white hover:bg-brand-700 transition-colors">
            Join as Creator
          </a>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-5">

        {/* Hero card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white text-2xl font-bold">
              {initials}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{name}</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                  <IconShield size={9} /> Brand
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-0.5">@{profile.username}</p>
              {profile.bio && (
                <p className="text-sm text-gray-600 mt-2 leading-relaxed">{profile.bio}</p>
              )}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {profile.category && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                    {profile.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details row */}
          {(profile.website || profile.updated_at) && (
            <div className="mt-5 pt-4 border-t border-gray-50 flex items-center gap-5 flex-wrap text-sm">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-brand-600 hover:underline font-medium">
                  <IconExternal size={12} />
                  {profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {profile.updated_at && (
                <span className="text-xs text-gray-400">
                  Active {timeAgo(profile.updated_at)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Looking for creators CTA */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {name} is discovering verified creators
              </p>
              <p className="text-xs text-gray-500 leading-relaxed">
                Brands on Statvora browse creator profiles with metrics pulled directly from platform APIs — no self-reported numbers.
                If you&apos;re a creator, build your verified profile and get discovered.
              </p>
              <a href="/signup"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                Build your verified creator profile →
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-4">
          <p className="text-xs text-gray-400">
            Powered by{" "}
            <a href="/" className="text-brand-600 font-medium hover:underline">Statvora</a>
            {" "}— creator intelligence platform
          </p>
        </div>

      </main>
    </div>
  );
}
