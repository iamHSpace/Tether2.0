import { ImageResponse } from "next/og";

export const runtime = "edge";
export const revalidate = 300;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function OgImage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  // Decode handle — strip the @ prefix to get the bare username
  const decoded = decodeURIComponent(handle);
  const username = decoded.startsWith("@") ? decoded.slice(1) : decoded;

  let name = `@${username}`;
  let category: string | null = null;
  let subscribers: number | null = null;
  let totalViews: number | null = null;
  let videoCount: number | null = null;
  let initials = username[0]?.toUpperCase() ?? "?";

  try {
    const res = await fetch(`${BACKEND}/api/creators/${encodeURIComponent(username)}`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      name = data.profile?.full_name ?? `@${username}`;
      category = data.profile?.category ?? null;
      initials = (data.profile?.full_name?.[0] ?? username[0] ?? "?").toUpperCase();
      const ch = data.snapshots?.["youtube"]?.data?.channel;
      if (ch) {
        subscribers = ch.subscribers;
        totalViews = ch.totalViews;
        videoCount = ch.videoCount;
      }
    }
  } catch {
    // render with defaults
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "linear-gradient(135deg, #f5f0e8 0%, #ede8f0 50%, #e8e0f5 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "60px 72px",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Top bar: Statvora brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white" />
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12l10 5 10-5" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: 22, fontWeight: 700, color: "#1f1f2e", letterSpacing: "-0.3px" }}>Statvora</span>
          <div
            style={{
              marginLeft: 12,
              padding: "4px 12px",
              borderRadius: 20,
              background: "#e8f5e9",
              border: "1px solid #c8e6c9",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 8, height: 8, borderRadius: 4, background: "#4caf50" }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#2e7d32" }}>Verified Creator</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", alignItems: "center", gap: 40, flex: 1 }}>
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 32,
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 58,
              fontWeight: 800,
              color: "white",
              flexShrink: 0,
              boxShadow: "0 8px 32px rgba(124,58,237,0.3)",
            }}
          >
            {initials}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 52, fontWeight: 800, color: "#1f1f2e", letterSpacing: "-1px", lineHeight: 1.1 }}>
              {name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22, color: "#6b7280" }}>@{username}</span>
              {category && (
                <div
                  style={{
                    padding: "4px 14px",
                    borderRadius: 20,
                    background: "#f3e8ff",
                    border: "1px solid #e9d5ff",
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#7c3aed",
                  }}
                >
                  {category}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {(subscribers !== null || totalViews !== null || videoCount !== null) && (
          <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
            {[
              subscribers !== null && { label: "Subscribers", value: fmtNum(subscribers) },
              totalViews !== null && { label: "Total Views", value: fmtNum(totalViews) },
              videoCount !== null && { label: "Videos", value: fmtNum(videoCount) },
              subscribers !== null && totalViews !== null && videoCount !== null && {
                label: "Avg Views",
                value: fmtNum(Math.round(totalViews / Math.max(videoCount, 1))),
              },
            ].filter(Boolean).map((stat) => {
              const s = stat as { label: string; value: string };
              return (
                <div
                  key={s.label}
                  style={{
                    flex: 1,
                    background: "rgba(255,255,255,0.7)",
                    borderRadius: 16,
                    padding: "18px 24px",
                    border: "1px solid rgba(255,255,255,0.9)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 32, fontWeight: 800, color: "#1f1f2e", letterSpacing: "-0.5px" }}>
                    {s.value}
                  </span>
                  <span style={{ fontSize: 14, color: "#9ca3af", fontWeight: 500 }}>{s.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom tagline */}
        <div style={{ marginTop: 28, fontSize: 16, color: "#9ca3af" }}>
          statvora.in/@{username} · Metrics verified via YouTube API
        </div>
      </div>
    ),
    { ...size }
  );
}
