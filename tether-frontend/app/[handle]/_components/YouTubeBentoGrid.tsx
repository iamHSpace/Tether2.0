/**
 * YouTubeBentoGrid.tsx
 *
 * Self-contained bento grid for YouTube analytics.
 * All colours are driven by CSS custom properties (--theme-*) so every
 * combination of Global Theme × Typography × Palette renders correctly.
 */

import { PlatformInfo, SnapshotData } from "@/lib/api";
import { IconYoutube, IconExternal, IconUsers } from "@/components/ui/Icons";
import {
  VisibilityConfig, MONO, fmtK,
  DarkAreaChart, BentoCard, StatLabel, StatValue, StatSub,
} from "./bento-shared";

// ─── unit suffix helper ───────────────────────────────────────────────────────
// Replaces hardcoded text-slate-500 with a CSS-var-driven colour
function Unit({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-base ml-1" style={{ color: "var(--theme-text-faint, #475569)" }}>
      {children}
    </span>
  );
}

// ─── chart badge helper ───────────────────────────────────────────────────────
function ChartBadge({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <span
      className="text-[11px] px-2.5 py-1 font-medium"
      style={{
        borderRadius: "9999px",
        background: `${accent}18`,
        border: `1px solid ${accent}35`,
        color: accent,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — derives all computed metrics from the raw snapshot
// ─────────────────────────────────────────────────────────────────────────────

function computeYtAnalytics(ytData: SnapshotData) {
  const { videos, channel: ch } = ytData;
  if (!videos?.length) return null;

  const sorted = [...videos].sort(
    (a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt)
  );

  const accountAgeDays =
    sorted.length > 1
      ? Math.round(
          (+new Date(sorted.at(-1)!.publishedAt) - +new Date(sorted[0].publishedAt)) /
          86_400_000
        )
      : 0;

  const uploadVelocity  = sorted.length > 1 ? accountAgeDays / (sorted.length - 1) : 0;
  const knownViews      = videos.reduce((s, v) => s + v.views, 0);
  const ghostViews      = Math.max(0, ch.totalViews - knownViews);
  const subToViewRatio  = ch.subscribers > 0 ? ch.totalViews / ch.subscribers : 0;

  const avgEngagement =
    videos.length > 0
      ? videos.reduce(
          (s, v) => s + (v.views > 0 ? ((v.likes + v.comments) / v.views) * 100 : 0),
          0
        ) / videos.length
      : 0;

  const viewsChartData  = sorted.map(v => v.views);
  const recencyDecayData = [...sorted].reverse().slice(0, 6).map(v => v.views);

  return {
    accountAgeDays, uploadVelocity, ghostViews,
    subToViewRatio, avgEngagement,
    viewsChartData, recencyDecayData,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function YouTubeBentoGrid({
  ytPlatform,
  ytData,
  vis,
}: {
  ytPlatform: PlatformInfo;
  ytData:     SnapshotData;
  vis:        VisibilityConfig;
}) {
  const ch              = ytData.channel;
  const analytics       = computeYtAnalytics(ytData);
  const avgViewsPerVideo = ch.videoCount > 0 ? Math.round(ch.totalViews / ch.videoCount) : 0;

  const textHi    = "var(--theme-text, #e2e8f0)";
  const textMd    = "var(--theme-text-muted, #94a3b8)";
  const textLo    = "var(--theme-text-faint, #475569)";
  const accent    = "var(--theme-accent, #7c3aed)";
  const accentAlt = "var(--theme-accent-alt, #ec4899)";

  return (
    <div className="space-y-5">

      {/* Platform identity row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
            <IconYoutube size={17} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: textHi }}>
              {ytPlatform.platform_username}
            </p>
            {ch.handle && (
              <p className="text-xs" style={{ ...MONO, color: textLo }}>{ch.handle}</p>
            )}
          </div>
        </div>
        <a
          href={`https://youtube.com/channel/${ytPlatform.platform_user_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
          style={{ color: textLo }}
        >
          <IconExternal size={11} /> View channel
        </a>
      </div>

      {/* ── Row 1: Hero stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {vis.yt_subscribers && (
          <BentoCard span="col-span-2" glow="red" accentTint="rgba(239,68,68,0.08)">
            <div className="flex items-start justify-between mb-3">
              <StatLabel>Subscribers</StatLabel>
              <IconUsers size={14} className="text-red-400" />
            </div>
            <StatValue size="2xl">{fmtK(ch.subscribers)}</StatValue>
            <StatSub>Total subscriber count</StatSub>
          </BentoCard>
        )}

        {vis.yt_total_views && (
          <BentoCard>
            <StatLabel>Total Views</StatLabel>
            <StatValue size="xl">{fmtK(ch.totalViews)}</StatValue>
            <StatSub>Lifetime view count</StatSub>
          </BentoCard>
        )}

        {vis.yt_video_count && (
          <BentoCard>
            <StatLabel>Videos</StatLabel>
            <StatValue size="xl">{ch.videoCount.toLocaleString()}</StatValue>
            <StatSub>Uploaded to date</StatSub>
          </BentoCard>
        )}
      </div>

      {/* ── Row 2: Derived metrics ── */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {vis.yt_avg_views && (
            <BentoCard>
              <StatLabel>Avg Views / Video</StatLabel>
              <StatValue size="lg">{fmtK(avgViewsPerVideo)}</StatValue>
              <StatSub>across {ch.videoCount} videos</StatSub>
            </BentoCard>
          )}

          {vis.yt_content_span && (
            <BentoCard>
              <StatLabel>Content Span</StatLabel>
              <StatValue size="lg">
                {analytics.accountAgeDays.toLocaleString()}
                <Unit>d</Unit>
              </StatValue>
              <StatSub>days since first upload</StatSub>
            </BentoCard>
          )}

          {vis.yt_sub_view_ratio && (
            <BentoCard>
              <StatLabel>Sub-to-View Ratio</StatLabel>
              <StatValue size="lg">
                {(Math.round(analytics.subToViewRatio * 10) / 10).toFixed(1)}
                <Unit>×</Unit>
              </StatValue>
              <StatSub>views per subscriber</StatSub>
            </BentoCard>
          )}

          {vis.yt_ghost_views && (
            <BentoCard>
              <StatLabel>Ghost Views</StatLabel>
              <StatValue size="lg">{fmtK(analytics.ghostViews)}</StatValue>
              <StatSub>unlisted / older content</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 3: Upload cadence metrics ── */}
      {analytics && (vis.yt_upload_velocity || vis.yt_avg_engagement) && (
        <div className="grid grid-cols-2 gap-3">
          {vis.yt_upload_velocity && (
            <BentoCard>
              <StatLabel>Upload Velocity</StatLabel>
              <StatValue size="lg">
                {(Math.round(analytics.uploadVelocity * 10) / 10).toFixed(1)}
                <Unit>d</Unit>
              </StatValue>
              <StatSub>avg days between uploads</StatSub>
            </BentoCard>
          )}

          {vis.yt_avg_engagement && (
            <BentoCard glow="purple">
              <StatLabel>Avg Engagement</StatLabel>
              <StatValue size="lg">
                {analytics.avgEngagement.toFixed(2)}
                <Unit>%</Unit>
              </StatValue>
              <StatSub>(likes + comments) / views</StatSub>
            </BentoCard>
          )}
        </div>
      )}

      {/* ── Row 4: Views by video — full-width area chart ── */}
      {vis.yt_views_by_video && analytics && ytData.videos.length >= 3 && (
        <BentoCard span="col-span-full" glow="purple">
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>Views by Video</StatLabel>
              <p className="text-xs" style={{ color: textMd }}>
                Oldest → newest · {ytData.videos.length} videos
              </p>
            </div>
            <ChartBadge accent={accent}>Area chart</ChartBadge>
          </div>
          <div className="mt-4">
            <DarkAreaChart
              data={analytics.viewsChartData}
              color="var(--theme-accent, #7c3aed)"
              gradientId="yt-views"
            />
          </div>
        </BentoCard>
      )}

      {/* ── Row 5: Recency decay ── */}
      {vis.yt_recency_decay && analytics && analytics.recencyDecayData.length >= 3 && (
        <BentoCard>
          <div className="flex items-start justify-between mb-1">
            <div>
              <StatLabel>Recency Decay</StatLabel>
              <p className="text-xs" style={{ color: textMd }}>
                Views on last 6 uploads (newest first)
              </p>
            </div>
            <ChartBadge accent={accentAlt}>Area chart</ChartBadge>
          </div>
          <div className="mt-4">
            <DarkAreaChart
              data={analytics.recencyDecayData}
              color="var(--theme-accent-alt, #f59e0b)"
              gradientId="yt-decay"
            />
          </div>
        </BentoCard>
      )}

      {/* ── Row 6: Per-video feed table ── */}
      {vis.yt_video_feed && ytData.videos.length > 0 && (
        <BentoCard>
          <StatLabel>Video Feed</StatLabel>
          <p className="text-xs mb-4" style={{ color: textMd }}>
            Most recent {Math.min(ytData.videos.length, 8)} uploads
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--theme-border, rgba(255,255,255,0.06))" }}>
                  {["Title", "Views", "Likes", "Comments", "Published"].map(h => (
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
                {[...ytData.videos]
                  .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt))
                  .slice(0, 8)
                  .map((v, i) => (
                    <tr
                      key={v.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid var(--theme-border, rgba(255,255,255,0.04))",
                        background: i % 2 !== 0
                          ? "var(--theme-surface, rgba(255,255,255,0.01))"
                          : "transparent",
                      }}
                    >
                      <td className="py-2.5 px-2 max-w-[200px] truncate" style={{ color: textHi }}>
                        {v.title ?? "—"}
                      </td>
                      <td className="py-2.5 px-2 font-semibold" style={{ ...MONO, color: textHi }}>
                        {fmtK(v.views)}
                      </td>
                      <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                        {fmtK(v.likes)}
                      </td>
                      <td className="py-2.5 px-2" style={{ ...MONO, color: textMd }}>
                        {fmtK(v.comments)}
                      </td>
                      <td className="py-2.5 px-2" style={{ ...MONO, color: textLo }}>
                        {new Date(v.publishedAt).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </BentoCard>
      )}

    </div>
  );
}
