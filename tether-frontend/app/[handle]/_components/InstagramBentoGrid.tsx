/**
 * InstagramBentoGrid.tsx
 *
 * Self-contained bento grid for Instagram analytics.
 * All colours driven by CSS custom properties (--theme-*).
 */

import { PlatformInfo, InstagramSnapshotData } from "@/lib/api";
import { IconInstagram, IconExternal, IconUsers } from "@/components/ui/Icons";
import {
  VisibilityConfig, MONO, fmtK, fmtPrecise,
  DailyBarChart, HorizontalBarChart, DonutChart,
  BentoCard, StatLabel, StatValue, StatSub, VerifiedPill,
} from "./bento-shared";

// ─── shared CSS var shortcuts ─────────────────────────────────────────────────
const textHi    = "var(--theme-text, #e2e8f0)";
const textMd    = "var(--theme-text-muted, #94a3b8)";
const textLo    = "var(--theme-text-faint, #475569)";
const accent    = "var(--theme-accent, #7c3aed)";
const accentAlt = "var(--theme-accent-alt, #ec4899)";

// ─── chart badge ──────────────────────────────────────────────────────────────
function ChartBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="text-[11px] px-2.5 py-1 font-medium"
      style={{
        borderRadius: "9999px",
        background: `${color}18`,
        border: `1px solid ${color}35`,
        color,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audience parsers
// ─────────────────────────────────────────────────────────────────────────────

function parseGenderAge(raw: Record<string, number>) {
  let male = 0;
  let female = 0;
  const brackets: { label: string; pct: number; gender: "M" | "F" }[] = [];

  for (const [key, val] of Object.entries(raw)) {
    const pct    = val > 1 ? Math.round(val) : Math.round(val * 100);
    const gender: "M" | "F" = key.startsWith("M.") ? "M" : "F";
    const ageRange = key.replace(/^[MF]\./, "");
    brackets.push({ label: `${gender} ${ageRange}`, pct, gender });
    if (gender === "M") male   += pct;
    else                female += pct;
  }

  brackets.sort((a, b) => b.pct - a.pct);

  return {
    male:   Math.round((male   / (male + female)) * 100) || 0,
    female: Math.round((female / (male + female)) * 100) || 0,
    brackets: brackets.slice(0, 8),
    donutSlices: brackets.slice(0, 6).map((b, i) => ({
      value: b.pct,
      label: b.label,
      color: b.gender === "M"
        ? (["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"][Math.floor(i / 2)] ?? "#e0e7ff")
        : (["#ec4899", "#f472b6", "#f9a8d4", "#fce7f3"][Math.floor(i / 2)] ?? "#fdf2f8"),
    })),
  };
}

function parseTopCountries(raw: Record<string, number>) {
  return Object.entries(raw)
    .map(([code, val]) => ({
      label: code,
      value: val > 1 ? Math.round(val) : Math.round(val * 100),
      pct:   val > 1 ? Math.round(val) : Math.round(val * 100),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function InstagramBentoGrid({
  igPlatform,
  igData,
  vis,
}: {
  igPlatform: PlatformInfo;
  igData:     InstagramSnapshotData;
  vis:        VisibilityConfig;
}) {
  const { account, posts, account_insights: ins } = igData;

  const hasInsights     = !!ins;
  const hasReach        = !!(ins?.reach_30d?.length);
  const reach30dTotal   = hasReach ? ins!.reach_30d!.reduce((s, v) => s + v, 0) : 0;
  const hasCountry      = !!(ins?.audience_country    && Object.keys(ins.audience_country).length    > 0);
  const hasAgeGender    = !!(ins?.audience_gender_age && Object.keys(ins.audience_gender_age).length > 0);
  const postsWithIns    = posts.filter(p => p.reach !== undefined);
  const hasPostInsights = postsWithIns.length > 0;

  const ga        = hasAgeGender ? parseGenderAge(ins!.audience_gender_age!) : null;
  const countries = hasCountry   ? parseTopCountries(ins!.audience_country!) : null;

  const borderVar = "var(--theme-border, rgba(255,255,255,0.06))";

  return (
    <div className="space-y-5">

      {/* Platform identity row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-pink-500/20 flex items-center justify-center">
            <IconInstagram size={17} className="text-pink-400" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: textHi }}>@{account.username}</p>
            <p className="text-xs" style={{ color: textLo }}>{account.name}</p>
          </div>
        </div>
        <a
          href={`https://instagram.com/${account.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: textLo }}
        >
          <IconExternal size={11} /> View profile
        </a>
      </div>

      {/* ── Row 1: Core stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {vis.ig_followers && (
          <BentoCard span="col-span-2" glow="pink" accentTint="rgba(236,72,153,0.08)">
            <div className="flex items-start justify-between mb-3">
              <StatLabel>Followers</StatLabel>
              <IconUsers size={14} className="text-pink-400" />
            </div>
            <StatValue size="2xl">{fmtK(account.followers_count)}</StatValue>
            <StatSub>Total followers</StatSub>
          </BentoCard>
        )}

        {vis.ig_posts && (
          <BentoCard>
            <StatLabel>Posts</StatLabel>
            <StatValue size="xl">{account.media_count.toLocaleString()}</StatValue>
            <StatSub>Total posts published</StatSub>
          </BentoCard>
        )}

        {vis.ig_reach_30d_total && hasReach && (
          <BentoCard glow="purple">
            <StatLabel>30-Day Reach</StatLabel>
            <StatValue size="xl">{fmtK(reach30dTotal)}</StatValue>
            <StatSub>unique accounts reached</StatSub>
          </BentoCard>
        )}
      </div>

      {/* ── Row 2: 30-day daily reach chart (full width) ── */}
      {vis.ig_reach_30d_chart && hasReach && (
        <BentoCard span="col-span-full" glow="pink">
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>30-Day Reach</StatLabel>
              <p className="text-xs" style={{ color: textMd }}>
                Daily unique accounts reached · last 30 days
              </p>
            </div>
            <div className="flex items-center gap-2">
              <VerifiedPill />
              <ChartBadge color={accentAlt}>Daily bar chart</ChartBadge>
            </div>
          </div>
          <div className="mt-4">
            <DailyBarChart data={ins!.reach_30d!} color="var(--theme-accent-alt, #ec4899)" />
          </div>
          <div className="flex justify-between text-[10px] mt-1 px-0.5" style={{ color: textLo }}>
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </BentoCard>
      )}

      {/* ── Row 3: 7-day activity insights ── */}
      {hasInsights && (vis.ig_profile_views_7d || vis.ig_website_clicks_7d) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {vis.ig_profile_views_7d && ins?.profile_views !== undefined && (
            <BentoCard>
              <StatLabel>Profile Views 7d</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.profile_views)}</StatValue>
              <StatSub>page visits this week</StatSub>
            </BentoCard>
          )}
          {vis.ig_website_clicks_7d && ins?.website_clicks !== undefined && (
            <BentoCard>
              <StatLabel>Website Clicks 7d</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.website_clicks)}</StatValue>
              <StatSub>link-in-bio taps</StatSub>
            </BentoCard>
          )}
          {ins?.account_reach !== undefined && (
            <BentoCard>
              <StatLabel>Account Reach</StatLabel>
              <StatValue size="lg">{fmtPrecise(ins.account_reach)}</StatValue>
              <StatSub>unique accounts</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 4: Audience — country + age/gender ── */}
      {(hasCountry || hasAgeGender) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* Country breakdown */}
          {vis.ig_audience_country && countries && (
            <BentoCard>
              <div className="flex items-center justify-between mb-4">
                <StatLabel>Audience Country</StatLabel>
                <ChartBadge color="#14b8a6">Horizontal bar</ChartBadge>
              </div>
              <HorizontalBarChart items={countries} color="var(--theme-accent, #14b8a6)" />
            </BentoCard>
          )}

          {/* Age / gender */}
          {vis.ig_audience_age_gender && ga && (
            <BentoCard>
              <div className="flex items-center justify-between mb-3">
                <StatLabel>Age &amp; Gender</StatLabel>
                <ChartBadge color={accent}>Donut chart</ChartBadge>
              </div>
              <div className="flex items-center gap-5">
                <div className="shrink-0">
                  <DonutChart slices={ga.donutSlices} />
                </div>
                <div className="flex-1 space-y-3">
                  {/* Gender split bar */}
                  <div>
                    <div className="flex rounded-full overflow-hidden h-2 mb-1.5">
                      <div className="bg-indigo-400" style={{ width: `${ga.male}%` }} />
                      <div className="bg-pink-400 flex-1" />
                    </div>
                    <div className="flex gap-3 text-[11px]" style={{ color: textMd }}>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                        M {ga.male}%
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />
                        F {ga.female}%
                      </span>
                    </div>
                  </div>
                  {/* Top age brackets */}
                  <div className="space-y-1.5">
                    {ga.brackets.slice(0, 4).map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 shrink-0" style={{ ...MONO, color: textLo }}>
                          {b.label}
                        </span>
                        <div
                          className="flex-1 rounded-full h-1 overflow-hidden"
                          style={{ background: "var(--theme-border, rgba(255,255,255,0.06))" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(b.pct * 2, 100)}%`,
                              background: b.label.startsWith("M") ? "#818cf8" : "#f472b6",
                            }}
                          />
                        </div>
                        <span className="text-[10px] w-7 text-right" style={{ ...MONO, color: textLo }}>
                          {b.pct}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 5: Per-post feed table ── */}
      {vis.ig_post_feed && posts.length > 0 && (
        <BentoCard>
          <StatLabel>Post Feed</StatLabel>
          <p className="text-xs mb-4" style={{ color: textMd }}>
            Recent {Math.min(posts.length, 9)} posts
            {hasPostInsights ? " — API-verified per-post insights" : " — engagement data"}
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[540px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${borderVar}` }}>
                  {[
                    "#", "Type", "Likes", "Comments",
                    ...(hasPostInsights
                      ? ["Reach", "Saves", "Shares", "Follows", "Profile Visits"]
                      : []
                    ),
                    "Date",
                  ].map(h => (
                    <th
                      key={h}
                      className="text-left py-2 px-2 text-[10px] font-semibold uppercase tracking-widest"
                      style={{ color: textLo }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.slice(0, 9).map((p, i) => (
                  <tr
                    key={p.id}
                    className="transition-colors"
                    style={{ borderBottom: `1px solid ${borderVar}` }}
                  >
                    <td className="py-2.5 px-2" style={{ ...MONO, color: textLo }}>{i + 1}</td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          p.media_type === "VIDEO"
                            ? "bg-red-500/10 text-red-400"
                            : p.media_type === "CAROUSEL_ALBUM"
                            ? "bg-violet-500/10 text-violet-400"
                            : "bg-pink-500/10 text-pink-400"
                        }`}
                      >
                        {p.media_type === "CAROUSEL_ALBUM" ? "ALBUM" : p.media_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 font-semibold" style={{ ...MONO, color: textHi }}>
                      {fmtK(p.like_count)}
                    </td>
                    <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                      {fmtK(p.comments_count)}
                    </td>
                    {hasPostInsights && (
                      <>
                        <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                          {p.reach    !== undefined ? fmtK(p.reach)    : "—"}
                        </td>
                        <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                          {p.saved    !== undefined ? fmtK(p.saved)    : "—"}
                        </td>
                        <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                          {p.shares   !== undefined ? fmtK(p.shares)   : "—"}
                        </td>
                        <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                          {p.follows  !== undefined ? fmtK(p.follows)  : "—"}
                        </td>
                        <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                          {p.profile_visits !== undefined ? fmtK(p.profile_visits) : "—"}
                        </td>
                      </>
                    )}
                    <td className="py-2.5 px-2" style={{ ...MONO, color: textLo }}>
                      {new Date(p.timestamp).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

      {/* ── Row 6: Stories breakdown ── */}
      {vis.ig_stories && igData.stories && igData.stories.length > 0 && (() => {
        const s             = igData.stories!;
        const totalReach    = s.reduce((a, st) => a + (st.reach        ?? 0), 0);
        const totalImpr     = s.reduce((a, st) => a + (st.impressions  ?? 0), 0);
        const totalExits    = s.reduce((a, st) => a + (st.exits        ?? 0), 0);
        const totalReplies  = s.reduce((a, st) => a + (st.replies      ?? 0), 0);
        const totalTapsFwd  = s.reduce((a, st) => a + (st.taps_forward ?? 0), 0);
        const totalTapsBack = s.reduce((a, st) => a + (st.taps_back    ?? 0), 0);
        const exitRate      = totalImpr > 0
          ? ((totalExits / totalImpr) * 100).toFixed(1)
          : null;

        return (
          <BentoCard>
            <StatLabel>Stories Breakdown</StatLabel>
            <p className="text-xs mb-4" style={{ color: textMd }}>
              Aggregated across {s.length} recent stories
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "Reach",       value: fmtK(totalReach) },
                { label: "Impressions", value: fmtK(totalImpr) },
                { label: "Exit Rate",   value: exitRate ? `${exitRate}%` : "—" },
                { label: "Replies",     value: fmtK(totalReplies) },
                { label: "Taps Fwd",    value: fmtK(totalTapsFwd) },
                { label: "Taps Back",   value: fmtK(totalTapsBack) },
              ].map(m => (
                <div
                  key={m.label}
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--theme-surface, rgba(255,255,255,0.03))",
                    border: `1px solid ${borderVar}`,
                  }}
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                    style={{ color: textLo }}
                  >
                    {m.label}
                  </p>
                  <p className="text-lg font-bold" style={{ ...MONO, color: textHi }}>
                    {m.value}
                  </p>
                </div>
              ))}
            </div>
          </BentoCard>
        );
      })()}

      {/* ── Row 7: Recent posts image grid ── */}
      {posts.length > 0 && (
        <BentoCard>
          <StatLabel>Recent Posts</StatLabel>
          <p className="text-xs mb-4" style={{ color: textMd }}>
            Latest {Math.min(posts.length, 9)} · hover for metrics
          </p>
          <div className="grid grid-cols-3 gap-2">
            {posts.slice(0, 9).map(post => {
              const thumb =
                post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
              return (
                <div
                  key={post.id}
                  className="relative aspect-square overflow-hidden group"
                  style={{
                    borderRadius: "var(--theme-radius, 0.75rem)",
                    border: `1px solid ${borderVar}`,
                    background: "var(--theme-surface, rgba(255,255,255,0.04))",
                  }}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={post.caption ?? "Post"}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <IconInstagram size={22} className="text-pink-400/40" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div
                    className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2 text-white text-[11px] font-semibold"
                    style={MONO}
                  >
                    <span>♥ {fmtK(post.like_count)}</span>
                    <span>💬 {fmtK(post.comments_count)}</span>
                    {post.reach          !== undefined && <span>👁 {fmtK(post.reach)}</span>}
                    {post.saved          !== undefined && <span>🔖 {fmtK(post.saved)}</span>}
                    {post.shares         !== undefined && <span>↗ {fmtK(post.shares)}</span>}
                    {post.follows        !== undefined && <span>➕ {fmtK(post.follows)}</span>}
                    {post.profile_visits !== undefined && <span>👤 {fmtK(post.profile_visits)}</span>}
                  </div>

                  {/* Media-type badge */}
                  {post.media_type === "VIDEO" && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">▶</div>
                  )}
                  {post.media_type === "CAROUSEL_ALBUM" && (
                    <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5 text-[9px] text-white font-bold">⊞</div>
                  )}
                </div>
              );
            })}
          </div>
        </BentoCard>
      )}

    </div>
  );
}
