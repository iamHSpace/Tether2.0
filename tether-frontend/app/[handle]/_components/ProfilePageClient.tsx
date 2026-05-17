"use client";

/**
 * ProfilePageClient.tsx
 *
 * Client component that renders the full creator public profile UI.
 * Receives all server-fetched data as props so page.tsx (Server Component)
 * can stay a pure data-fetcher for ISR.
 *
 * Wraps everything in <ThemeProvider> so CSS variables + CustomizerPanel are
 * available everywhere below.
 */

import type { Profile, PlatformInfo, SnapshotData, InstagramSnapshotData, ProfileThemeConfig } from "@/lib/api";
import {
  IconYoutube, IconInstagram, IconExternal, IconShield,
} from "@/components/ui/Icons";
import { timeAgo } from "@/lib/utils";
import { fmt } from "@/lib/utils";
import { ShareButton } from "./ShareButton";
import { TrackView } from "./TrackView";
import {
  VisibilityConfig, BentoCard, StatLabel, DISPLAY_STYLE, MONO,
} from "./bento-shared";
import { YouTubeBentoGrid } from "./YouTubeBentoGrid";
import { InstagramBentoGrid } from "./InstagramBentoGrid";
import { ThemeProvider } from "./ThemeProvider";
import { useTheme } from "./theme-context";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfilePageClientProps {
  fontClasses:  string;          // e.g. `${playfair.variable} ${jetbrains.variable} ...`
  username:     string;
  profile:      Profile;
  platforms:    PlatformInfo[];
  ytPlatform:   PlatformInfo | null;
  igPlatform:   PlatformInfo | null;
  ytData:       SnapshotData | null;
  igData:       InstagramSnapshotData | null;
  capturedAt:   string | null;
  vis:          VisibilityConfig;
  themeConfig?: ProfileThemeConfig | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage labels
// ─────────────────────────────────────────────────────────────────────────────

const stageLabels: Record<string, string> = {
  just_starting: "Just Starting", growing: "Growing Fast",
  established:   "Established",   pro:     "Pro Creator",
};

// ─────────────────────────────────────────────────────────────────────────────
// Platform divider
// ─────────────────────────────────────────────────────────────────────────────

function PlatformDivider({
  platform, icon: Icon, iconColor, accentVar,
}: {
  platform:  string;
  icon:      React.ElementType;
  iconColor: string;
  accentVar: string;
}) {
  const { vars } = useTheme();
  const border   = vars["--theme-border"] ?? "rgba(255,255,255,0.08)";
  const accent   = (vars as Record<string, string>)[accentVar] ?? iconColor;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${border}, transparent)` }} />
      <div
        className="flex items-center gap-2 px-4 py-1.5 text-xs font-bold"
        style={{
          borderRadius: vars["--theme-radius"] ?? "1rem",
          border: `1px solid ${border}`,
          color: accent,
          background: `${accent}12`,
        }}
      >
        <Icon size={13} /> {platform}
      </div>
      <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${border}, transparent)` }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero section
// ─────────────────────────────────────────────────────────────────────────────

function HeroSection({
  profile, platforms, capturedAt, username,
}: {
  profile:    Profile;
  platforms:  PlatformInfo[];
  capturedAt: string | null;
  username:   string;
}) {
  const { vars, config } = useTheme();

  const initials = (profile.full_name?.[0] ?? profile.username?.[0] ?? "?").toUpperCase();
  const ytLinked = platforms.some(p => p.platform === "youtube");
  const igLinked = platforms.some(p => p.platform === "instagram");

  const accent    = vars["--theme-accent"]     ?? "#7c3aed";
  const accentAlt = vars["--theme-accent-alt"] ?? "#ec4899";
  const textHi    = vars["--theme-text"]       ?? "#e2e8f0";
  const textMd    = vars["--theme-text-muted"] ?? "#94a3b8";
  const textLo    = vars["--theme-text-faint"] ?? "#475569";
  const border    = vars["--theme-border"]     ?? "rgba(255,255,255,0.08)";
  const radius    = vars["--theme-radius"]     ?? "1rem";
  const heroFrom  = vars["--theme-hero-from"]  ?? "rgba(15,23,42,0.85)";
  const heroTo    = vars["--theme-hero-to"]    ?? "rgba(2,6,23,0.8)";
  const fontDisp  = vars["--theme-font-display"] ?? "inherit";
  const isBrut    = config.theme === "brutalist";
  const isArcade  = config.theme === "arcade";

  const tagStyle = (col: string): React.CSSProperties => ({
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "2px 10px", fontSize: 12, fontWeight: 500,
    borderRadius: radius === "0px" ? "2px" : "9999px",
    border: isBrut ? `2px solid ${col}` : `1px solid ${col}40`,
    background: isBrut ? `${col}22` : `${col}14`,
    color: col,
  });

  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: radius,
        border: `${vars["--theme-card-border-width"] ?? "1px"} ${vars["--theme-card-border-style"] ?? "solid"} ${border}`,
        background: `linear-gradient(135deg, ${heroFrom} 0%, ${heroTo} 100%)`,
        boxShadow: vars["--theme-card-shadow"] ?? "none",
      }}
    >
      {/* Ambient blobs — only for glassmorphic */}
      {config.theme === "glassmorphic" && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-pink-600/10 blur-3xl" />
        </div>
      )}

      <div className="relative z-10 p-7 md:p-9">
        <div className="flex flex-col md:flex-row md:items-start gap-6">

          {/* Avatar */}
          <div
            className="w-20 h-20 md:w-24 md:h-24 shrink-0 flex items-center justify-center text-3xl font-bold"
            style={{
              borderRadius: radius === "0px" ? "4px" : "1rem",
              background: `linear-gradient(135deg, ${accent}, ${accentAlt})`,
              color: "#fff",
              fontFamily: fontDisp,
              boxShadow: isArcade ? `0 0 20px ${accent}60` : undefined,
            }}
          >
            {initials}
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1
                className="text-3xl md:text-4xl font-bold leading-tight"
                style={{ fontFamily: fontDisp, color: textHi, textShadow: isArcade ? `0 0 20px ${accent}` : undefined }}
              >
                {profile.full_name ?? `@${profile.username}`}
              </h1>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5"
                style={{ ...tagStyle("#10b981"), color: "#10b981" }}
              >
                <IconShield size={8} /> Verified
              </span>
            </div>

            <p className="text-sm mb-3" style={{ fontFamily: MONO.fontFamily, color: textMd }}>
              @{profile.username}
            </p>

            {profile.bio && (
              <p
                className="text-sm md:text-base leading-relaxed max-w-xl mb-4"
                style={{ color: textMd, fontFamily: vars["--theme-font-body"] ?? "inherit" }}
              >
                {profile.bio}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              {profile.category && (
                <span style={tagStyle(accent)}>{profile.category}</span>
              )}
              {profile.creator_stage && (
                <span style={{ ...tagStyle(border), color: textLo, borderColor: border }}>
                  {stageLabels[profile.creator_stage] ?? profile.creator_stage}
                </span>
              )}
              {ytLinked && (
                <span style={{ ...tagStyle("#ef4444"), color: "#ef4444" }}>
                  <IconYoutube size={11} /> YouTube
                </span>
              )}
              {igLinked && (
                <span style={{ ...tagStyle("#ec4899"), color: "#ec4899" }}>
                  <IconInstagram size={11} /> Instagram
                </span>
              )}
              {capturedAt && (
                <span
                  className="text-[11px] px-3 py-1 font-medium"
                  style={{
                    borderRadius: radius === "0px" ? "2px" : "9999px",
                    background: "#10b98112",
                    border: "1px solid #10b98130",
                    color: "#10b981",
                  }}
                >
                  Updated {timeAgo(capturedAt)}
                </span>
              )}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-row md:flex-col gap-2 shrink-0">
            <a
              href={`/login?intent=contact&creator=${username}`}
              className="px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition-all"
              style={{
                borderRadius: radius === "0px" ? "2px" : "0.75rem",
                background: `linear-gradient(135deg, ${accent}, ${accentAlt})`,
                boxShadow: isBrut ? `3px 3px 0 #000` : `0 4px 16px ${accent}40`,
              }}
            >
              Work With Me
            </a>
            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all"
                style={{
                  borderRadius: radius === "0px" ? "2px" : "0.75rem",
                  border: `${vars["--theme-card-border-width"] ?? "1px"} ${vars["--theme-card-border-style"] ?? "solid"} ${border}`,
                  color: textMd,
                  background: isBrut ? `${border}10` : undefined,
                  boxShadow: isBrut ? `2px 2px 0 #000` : undefined,
                }}
              >
                <IconExternal size={12} /> Website
              </a>
            )}
          </div>
        </div>

        {/* Verified notice */}
        <div
          className="mt-5 flex items-center gap-2 px-3 py-2.5"
          style={{
            borderRadius: radius === "0px" ? "2px" : "0.75rem",
            background: "#10b98110",
            border: "1px solid #10b98128",
          }}
        >
          <IconShield size={13} className="shrink-0 text-emerald-400" />
          <p className="text-[11px] flex-1" style={{ color: "#10b981" }}>
            All metrics are <strong>pulled directly from platform APIs</strong> — not self-reported or estimated.
          </p>
          <ShareButton />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// About card
// ─────────────────────────────────────────────────────────────────────────────

function AboutCard({ profile }: { profile: Profile }) {
  const { vars } = useTheme();
  const textHi = vars["--theme-text"]       ?? "#e2e8f0";
  const textMd = vars["--theme-text-muted"] ?? "#94a3b8";
  const accent = vars["--theme-accent"]     ?? "#7c3aed";

  if (!profile.creator_stage && !profile.aspiration && !profile.website) return null;

  return (
    <BentoCard>
      <StatLabel>About</StatLabel>
      <dl className="space-y-2.5 mt-2">
        {profile.creator_stage && (
          <div className="flex items-center justify-between text-sm">
            <dt style={{ color: textMd }}>Creator stage</dt>
            <dd className="font-medium" style={{ color: textHi }}>
              {stageLabels[profile.creator_stage] ?? profile.creator_stage}
            </dd>
          </div>
        )}
        {profile.aspiration && (
          <div className="flex items-center justify-between text-sm">
            <dt style={{ color: textMd }}>Aspiration</dt>
            <dd className="font-medium" style={{ color: textHi }}>
              {profile.aspiration.replace(/_/g, " ")}
            </dd>
          </div>
        )}
        {profile.website && (
          <div className="flex items-center justify-between text-sm">
            <dt style={{ color: textMd }}>Website</dt>
            <dd>
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium flex items-center gap-1"
                style={{ color: accent }}
              >
                {profile.website.replace(/^https?:\/\//, "")}
                <IconExternal size={10} />
              </a>
            </dd>
          </div>
        )}
      </dl>
    </BentoCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav bar
// ─────────────────────────────────────────────────────────────────────────────

function Nav({ username }: { username: string }) {
  const { vars, config } = useTheme();
  const navBg     = vars["--theme-nav-bg"]     ?? "rgba(7,12,24,0.85)";
  const navBorder = vars["--theme-nav-border"] ?? "rgba(255,255,255,0.06)";
  const accent    = vars["--theme-accent"]     ?? "#7c3aed";
  const accentAlt = vars["--theme-accent-alt"] ?? "#ec4899";
  const radius    = vars["--theme-radius"]     ?? "1rem";
  const isBrut    = config.theme === "brutalist";

  return (
    <nav
      className="sticky top-0 z-30"
      style={{
        background: navBg,
        borderBottom: `${vars["--theme-card-border-width"] ?? "1px"} ${vars["--theme-card-border-style"] ?? "solid"} ${navBorder}`,
        backdropFilter: isBrut ? undefined : "blur(16px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 flex items-center justify-center overflow-hidden"
            style={{
              borderRadius: radius === "0px" ? "4px" : "0.5rem",
              background: `linear-gradient(135deg, ${accent}, ${accentAlt})`,
            }}
          >
            <img src="/brand/logo-icon.svg" width={12} height={12} alt="Statvora" />
          </div>
          <span
            className="text-sm font-bold"
            style={{ color: vars["--theme-text"] ?? "#e2e8f0" }}
          >
            Statvora
          </span>
        </a>
        <div className="flex items-center gap-3">
          <ShareButton />
          <a
            href={`/login?intent=contact&creator=${username}`}
            className="hidden sm:flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white transition-all"
            style={{
              borderRadius: radius === "0px" ? "2px" : "0.5rem",
              background: `linear-gradient(135deg, ${accent}, ${accentAlt})`,
              boxShadow: isBrut ? "2px 2px 0 #000" : undefined,
            }}
          >
            Work With Me
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner page — reads layout from context
// ─────────────────────────────────────────────────────────────────────────────

function PageInner({
  username, profile, platforms, ytPlatform, igPlatform,
  ytData, igData, capturedAt, vis,
}: Omit<ProfilePageClientProps, "fontClasses">) {
  const { config, vars } = useTheme();
  const isSplit  = config.layout === "split";
  const textHi   = vars["--theme-text"]  ?? "#e2e8f0";
  const accent   = vars["--theme-accent"] ?? "#7c3aed";
  const accentAlt = vars["--theme-accent-alt"] ?? "#ec4899";
  const radius   = vars["--theme-radius"] ?? "1rem";
  const isBrut   = config.theme === "brutalist";

  const platformGrids = (
    <>
      {/* ── YouTube ── */}
      {ytPlatform && (
        <>
          <PlatformDivider
            platform="YouTube"
            icon={IconYoutube}
            iconColor="#ef4444"
            accentVar="--theme-accent"
          />
          {ytData ? (
            <YouTubeBentoGrid ytPlatform={ytPlatform} ytData={ytData} vis={vis} />
          ) : (
            <BentoCard>
              <div className="py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto"
                  style={{ background: "#ef444418", border: "1px solid #ef444430" }}>
                  <IconYoutube size={18} className="text-red-400" />
                </div>
                <p className="font-medium" style={{ color: textHi }}>YouTube connected</p>
                <p className="text-sm" style={{ color: vars["--theme-text-faint"] }}>
                  Metrics appear after the creator visits their dashboard.
                </p>
              </div>
            </BentoCard>
          )}
        </>
      )}

      {/* ── Instagram ── */}
      {igPlatform && (
        <>
          <PlatformDivider
            platform="Instagram"
            icon={IconInstagram}
            iconColor="#ec4899"
            accentVar="--theme-accent-alt"
          />
          {igData ? (
            <InstagramBentoGrid igPlatform={igPlatform} igData={igData} vis={vis} />
          ) : (
            <BentoCard>
              <div className="py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto"
                  style={{ background: "#ec489918", border: "1px solid #ec489930" }}>
                  <IconInstagram size={18} className="text-pink-400" />
                </div>
                <p className="font-medium" style={{ color: textHi }}>Instagram connected</p>
                <p className="text-sm" style={{ color: vars["--theme-text-faint"] }}>
                  Metrics appear after the creator visits their dashboard.
                </p>
              </div>
            </BentoCard>
          )}
        </>
      )}

      {/* No platforms */}
      {!ytPlatform && !igPlatform && (
        <BentoCard>
          <div className="py-10 text-center">
            <p className="font-medium mb-1" style={{ color: vars["--theme-text-muted"] }}>
              No platforms connected yet
            </p>
            <p className="text-sm" style={{ color: vars["--theme-text-faint"] }}>
              This creator hasn&apos;t linked any platform accounts.
            </p>
          </div>
        </BentoCard>
      )}
    </>
  );

  const footer = (
    <div className="text-center py-6 space-y-4">
      <p className="text-sm" style={{ color: vars["--theme-text-faint"] }}>
        Powered by{" "}
        <a href="/" style={{ color: accent }} className="font-medium hover:opacity-80 transition-opacity">
          Statvora
        </a>{" "}
        — verified creator analytics
      </p>
      <a
        href="/signup"
        className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white transition-all"
        style={{
          borderRadius: radius === "0px" ? "2px" : "0.75rem",
          background: `linear-gradient(135deg, ${accent}, ${accentAlt})`,
          boxShadow: isBrut ? "4px 4px 0 #000" : `0 8px 24px ${accent}30`,
        }}
      >
        Create your verified creator profile →
      </a>
    </div>
  );

  if (isSplit) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-5 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
          {/* Left column — sticky profile */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <HeroSection
              profile={profile} platforms={platforms}
              capturedAt={capturedAt} username={username}
            />
            <AboutCard profile={profile} />
          </div>

          {/* Right column — scrollable stats */}
          <div className="space-y-6">
            {platformGrids}
            {footer}
          </div>
        </div>
      </main>
    );
  }

  // Asymmetric (default single column)
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-5 py-8 space-y-6">
      <HeroSection
        profile={profile} platforms={platforms}
        capturedAt={capturedAt} username={username}
      />
      {platformGrids}
      <AboutCard profile={profile} />
      {footer}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export
// ─────────────────────────────────────────────────────────────────────────────

export function ProfilePageClient(props: ProfilePageClientProps) {
  const { fontClasses, themeConfig, ...rest } = props;

  return (
    <ThemeProvider fontClasses={fontClasses} initialConfig={themeConfig as Partial<import("./theme-context").ThemeConfig> | undefined}>
      <Nav username={rest.username} />
      <TrackView username={rest.username} />
      <PageInner {...rest} />
    </ThemeProvider>
  );
}
