/**
 * page.tsx — Creator public profile (ISR Server Component)
 *
 * Responsibilities:
 *  1. Load all font families required by the theme customiser.
 *  2. Fetch creator data from the backend (ISR, revalidated every 5 min).
 *  3. Build VisibilityConfig from profile.metric_visibility.
 *  4. Pass everything to <ProfilePageClient> (client component).
 *
 * <ProfilePageClient> owns all rendering, theme state, and the CustomizerPanel.
 */

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  // Sophisticate pairing
  Playfair_Display, Lato, Space_Mono,
  // Minimalist pairing
  Inter, JetBrains_Mono,
  // Retro Tech pairing
  VT323, Roboto, Inconsolata,
  // Heavyweight pairing
  Oswald, Open_Sans, Roboto_Mono,
} from "next/font/google";

import {
  Profile, PlatformInfo, MetricVisibility, DEFAULT_METRIC_VISIBILITY,
  SnapshotData, InstagramSnapshotData,
} from "@/lib/api";
import { fmt } from "@/lib/utils";
import { VisibilityConfig } from "./_components/bento-shared";
import { ProfilePageClient } from "./_components/ProfilePageClient";

// ─────────────────────────────────────────────────────────────────────────────
// ISR config
// ─────────────────────────────────────────────────────────────────────────────

export const revalidate = 300;

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL     ?? "https://statvora.in";

// ─────────────────────────────────────────────────────────────────────────────
// Font loading — one declaration per pairing
// All use CSS variable injection so ThemeProvider can switch via
// --theme-font-display / --theme-font-body / --theme-font-mono.
// ─────────────────────────────────────────────────────────────────────────────

// Sophisticate (default)
const playfair  = Playfair_Display({ subsets: ["latin"], weight: ["400","600","700","900"], variable: "--font-playfair",  display: "swap" });
const lato      = Lato(            { subsets: ["latin"], weight: ["300","400","700"],       variable: "--font-lato",      display: "swap" });
const spaceMono = Space_Mono(      { subsets: ["latin"], weight: ["400","700"],             variable: "--font-space-mono",display: "swap" });

// Minimalist
const inter     = Inter(           { subsets: ["latin"],                                    variable: "--font-inter",     display: "swap" });
const jetbrains = JetBrains_Mono(  { subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-jetbrains", display: "swap" });

// Retro Tech
const vt323       = VT323(         { subsets: ["latin"], weight: ["400"],                   variable: "--font-vt323",       display: "swap" });
const roboto      = Roboto(        { subsets: ["latin"], weight: ["300","400","500","700"],  variable: "--font-roboto",      display: "swap" });
const inconsolata = Inconsolata(   { subsets: ["latin"],                                    variable: "--font-inconsolata", display: "swap" });

// Heavyweight
const oswald    = Oswald(          { subsets: ["latin"], weight: ["400","500","600","700"],  variable: "--font-oswald",    display: "swap" });
const openSans  = Open_Sans(       { subsets: ["latin"],                                    variable: "--font-open-sans", display: "swap" });
const robotoMono= Roboto_Mono(     { subsets: ["latin"],                                    variable: "--font-roboto-mono",display: "swap" });

// Combined class string — applied to the root div so all CSS vars are in scope
const ALL_FONT_VARS = [
  playfair.variable, lato.variable, spaceMono.variable,
  inter.variable,    jetbrains.variable,
  vt323.variable,    roboto.variable,    inconsolata.variable,
  oswald.variable,   openSans.variable,  robotoMono.variable,
].join(" ");

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────────────────────

interface CreatorData {
  profile:   Profile;
  platforms: PlatformInfo[];
  snapshots: Record<string, { data: SnapshotData; captured_at: string }>;
}

async function getProfile(username: string): Promise<CreatorData | null> {
  const res = await fetch(
    `${BACKEND}/api/creators/${encodeURIComponent(username)}`,
    { next: { revalidate: 300 } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Backend ${res.status}`);
  return res.json();
}

function resolveHandle(raw: string): string | null {
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) return null;
  return decoded.slice(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEO metadata
// ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ handle: string }> }
): Promise<Metadata> {
  const { handle } = await params;
  const username   = resolveHandle(handle);
  if (!username) return { title: "Not found" };

  const data = await getProfile(username).catch(() => null);
  if (!data) return { title: "Creator not found" };

  const { profile, snapshots } = data;
  const name      = profile.full_name ?? `@${profile.username}`;
  const ytChannel = snapshots["youtube"]?.data?.channel;
  const subCount  = ytChannel?.subscribers;
  const category  = profile.category ? `${profile.category} creator` : "creator";
  const ogTitle   = `${name} — Verified ${category} profile on Statvora`;

  const descParts: string[] = [];
  if (subCount)    descParts.push(`${fmt(subCount)} YouTube subscribers`);
  if (profile.bio) descParts.push(profile.bio);
  descParts.push("All metrics verified directly from YouTube's API — no self-reported numbers.");
  const description = descParts.join(". ").slice(0, 160);
  const pageUrl     = `${APP_URL}/@${username}`;

  return {
    title: ogTitle,
    description,
    alternates: { canonical: pageUrl },
    openGraph: { type: "profile", siteName: "Statvora", title: ogTitle, description, url: pageUrl },
    twitter:   { card: "summary_large_image", title: ogTitle, description },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Visibility helper
// ─────────────────────────────────────────────────────────────────────────────

function buildVisibility(mv: MetricVisibility): VisibilityConfig {
  return {
    yt_subscribers:    mv.subscribers,   yt_total_views:    mv.total_views,
    yt_video_count:    mv.video_count,   yt_avg_views:      mv.avg_views,
    yt_content_span:   mv.avg_views,     yt_sub_view_ratio: mv.avg_views,
    yt_ghost_views:    mv.total_views,   yt_upload_velocity:mv.avg_views,
    yt_avg_engagement: mv.avg_views,
    yt_views_by_video: mv.view_chart,    yt_recency_decay:  mv.view_chart,
    yt_video_feed:     mv.recent_videos,
    ig_followers:           true, ig_posts:               true,
    ig_reach_30d_chart:     true, ig_reach_30d_total:     true,
    ig_profile_views_7d:    true, ig_website_clicks_7d:   true,
    ig_audience_country:    true, ig_audience_age_gender: true,
    ig_post_feed:           true, ig_stories:             true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function CreatorPublicProfile(
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle }  = await params;
  const username    = resolveHandle(handle);
  if (!username) return notFound();

  const data = await getProfile(username);
  if (!data) return notFound();

  const { profile, platforms, snapshots } = data;

  if (profile.user_type === "business") redirect(`/b/@${username}`);

  const mv: MetricVisibility =
    (profile.metric_visibility as MetricVisibility) ?? DEFAULT_METRIC_VISIBILITY;

  const ytPlatform = platforms.find(p => p.platform === "youtube")   ?? null;
  const igPlatform = platforms.find(p => p.platform === "instagram") ?? null;
  const ytSnap     = snapshots["youtube"];
  const igSnap     = snapshots["instagram"];
  const ytData     = (ytSnap?.data as unknown as SnapshotData)          ?? null;
  const igData     = (igSnap?.data as unknown as InstagramSnapshotData) ?? null;
  const capturedAt = ytSnap?.captured_at ?? igSnap?.captured_at ?? null;

  return (
    <ProfilePageClient
      fontClasses={ALL_FONT_VARS}
      username={username}
      profile={profile}
      platforms={platforms}
      ytPlatform={ytPlatform}
      igPlatform={igPlatform}
      ytData={ytData}
      igData={igData}
      capturedAt={capturedAt}
      vis={buildVisibility(mv)}
      themeConfig={profile.theme_config ?? null}
    />
  );
}
