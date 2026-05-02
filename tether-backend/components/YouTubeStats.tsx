"use client";

import { useEffect, useState } from "react";
import type { ChannelStats, VideoSummary } from "@/lib/youtube";
import { routes } from "@/lib/config";

interface StatsResponse {
  channel: ChannelStats;
  videos: VideoSummary[];
  connectedAt: string;
}

export default function YouTubeStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(routes.youtubeStats)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: "#888", marginTop: "1rem" }}>Loading YouTube data…</p>;
  }

  if (error) {
    return (
      <p style={{ color: "#c00", marginTop: "1rem", fontSize: "0.9rem" }}>
        Error: {error}
      </p>
    );
  }

  if (!data) return null;

  const { channel, videos } = data;

  return (
    <div style={{ marginTop: "1.25rem" }}>
      {/* Channel card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {channel.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.thumbnail}
              alt={channel.name}
              width={56}
              height={56}
              style={{ borderRadius: "50%" }}
            />
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{channel.name}</div>
            {channel.handle && (
              <div style={{ color: "#888", fontSize: "0.85rem" }}>{channel.handle}</div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "2rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
          <Stat label="Subscribers" value={fmt(channel.subscribers)} />
          <Stat label="Total Views" value={fmt(channel.totalViews)} />
          <Stat label="Videos" value={fmt(channel.videoCount)} />
        </div>
      </div>

      {/* Recent videos */}
      {videos.length > 0 && (
        <div style={{ marginTop: "1.25rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#444" }}>
            Recent Videos
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {videos.map((v) => (
              <div key={v.id} style={videoRowStyle}>
                {v.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail}
                    alt={v.title}
                    width={100}
                    height={56}
                    style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.9rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {v.title}
                  </div>
                  <div style={{ color: "#888", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                    {fmt(v.views)} views · {fmt(v.likes)} likes · {fmt(v.comments)} comments ·{" "}
                    {new Date(v.publishedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: "0.78rem", color: "#888", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

const cardStyle: React.CSSProperties = {
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 8,
  padding: "1.25rem",
};

const videoRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 6,
  padding: "0.6rem",
};
