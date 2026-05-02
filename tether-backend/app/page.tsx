import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { routes, platforms } from "@/lib/config";
import YouTubeStats from "@/components/YouTubeStats";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ youtube_connected?: string; youtube_error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Not logged in ────────────────────────────────────────────────────────
  if (!user) {
    return (
      <main style={styles.centered}>
        <h1>Tether</h1>
        <p style={{ color: "#555" }}>You are not signed in.</p>
        <a href={routes.login} style={styles.primaryBtn}>
          Sign in with Google
        </a>
      </main>
    );
  }

  // Check if YouTube is already connected (server-side, admin client bypasses RLS)
  const { data: ytRow } = await adminClient
    .from("platform_tokens")
    .select("platform_username, platform_user_id, created_at")
    .eq("user_id", user.id)
    .eq("platform", platforms.YOUTUBE)
    .maybeSingle();

  const youtubeConnected = !!ytRow;

  // ── Logged in ─────────────────────────────────────────────────────────────
  return (
    <main style={styles.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Tether Dashboard</h1>
          <p style={{ margin: "0.25rem 0 0", color: "#666", fontSize: "0.9rem" }}>
            {user.email}
          </p>
        </div>
        <form action={routes.logout} method="POST">
          <button type="submit" style={styles.dangerBtn}>Sign out</button>
        </form>
      </div>

      <hr style={{ margin: "1.5rem 0", borderColor: "#eee" }} />

      {/* Flash messages from OAuth callbacks */}
      {params.youtube_connected && (
        <div style={styles.successBanner}>✅ YouTube connected successfully!</div>
      )}
      {params.youtube_error && (
        <div style={styles.errorBanner}>
          ⚠️ YouTube error: {decodeURIComponent(params.youtube_error)}
        </div>
      )}

      {/* YouTube section */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>YouTube</h2>
          <a
            href={routes.youtubeOAuth}
            style={youtubeConnected ? styles.ghostBtn : styles.youtubeBtn}
          >
            {youtubeConnected ? "Reconnect" : "Connect YouTube"}
          </a>
        </div>

        {youtubeConnected ? (
          <YouTubeStats />
        ) : (
          <p style={{ color: "#888", marginTop: "1rem" }}>
            Connect your YouTube channel to see verified metrics here.
          </p>
        )}
      </section>
    </main>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const styles = {
  page: {
    fontFamily: "sans-serif",
    padding: "2rem",
    maxWidth: 720,
    margin: "0 auto",
  } as React.CSSProperties,

  centered: {
    fontFamily: "sans-serif",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    gap: "1rem",
  } as React.CSSProperties,

  primaryBtn: {
    padding: "0.65rem 1.5rem",
    background: "#4285F4",
    color: "#fff",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: "1rem",
  } as React.CSSProperties,

  youtubeBtn: {
    padding: "0.45rem 1rem",
    background: "#FF0000",
    color: "#fff",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: "0.9rem",
  } as React.CSSProperties,

  ghostBtn: {
    padding: "0.45rem 1rem",
    background: "transparent",
    color: "#555",
    border: "1px solid #ccc",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: "0.9rem",
  } as React.CSSProperties,

  dangerBtn: {
    padding: "0.45rem 1rem",
    background: "#e00",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: "0.9rem",
  } as React.CSSProperties,

  successBanner: {
    padding: "0.75rem 1rem",
    background: "#f0fff4",
    border: "1px solid #9ae6b4",
    borderRadius: 6,
    marginBottom: "1.25rem",
    color: "#276749",
  } as React.CSSProperties,

  errorBanner: {
    padding: "0.75rem 1rem",
    background: "#fff5f5",
    border: "1px solid #feb2b2",
    borderRadius: 6,
    marginBottom: "1.25rem",
    color: "#c53030",
  } as React.CSSProperties,
};
