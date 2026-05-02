/**
 * lib/swagger.ts
 *
 * OpenAPI 3.0.3 specification for the Tether 2.0 API.
 *
 * Served as JSON by GET /api/docs
 * Rendered as interactive UI at /docs (Swagger UI via CDN)
 *
 * All routes are documented here. To add a new route:
 *   1. Add its path under `paths`
 *   2. Add any new response/request schemas under `components.schemas`
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";

export function getSwaggerSpec() {
  return {
    openapi: "3.0.3",

    // ─── Info ─────────────────────────────────────────────────────────────────
    info: {
      title: "Tether 2.0 API",
      version: "1.0.0",
      description: `
## Overview

Tether 2.0 is a creator intelligence platform. Creators connect their social accounts and get a unified, verified analytics dashboard. This API powers the backend — authentication, platform OAuth connections, and live metrics.

## Authentication

Tether supports two sign-in methods:

**1. Email / Password** (client-side, via Supabase JS SDK)
- Sign up: \`supabase.auth.signUp({ email, password })\` → \`POST /auth/v1/signup\`
- Sign in: \`supabase.auth.signInWithPassword({ email, password })\` → \`POST /auth/v1/token?grant_type=password\`
- These are Supabase internal endpoints, not Tether API routes.

**2. Google OAuth (PKCE flow)**
- Initiated by visiting \`GET /api/oauth/youtube\` or clicking "Continue with Google"
- Supabase handles the Google redirect; Tether receives the code at \`GET /api/auth/callback\`

After either method, the session is stored in \`sb-*\` cookies and refreshed by \`middleware.ts\` on every request. All protected endpoints read the session from those cookies — no Bearer token needed.

## Base URL

\`${APP_URL}\`

## Error format

All JSON errors follow the shape:
\`\`\`json
{ "error": "Human-readable message" }
\`\`\`
      `.trim(),
      contact: {
        name: "Tether Team",
      },
    },

    // ─── Servers ──────────────────────────────────────────────────────────────
    servers: [
      {
        url: APP_URL,
        description: "Local development server",
      },
    ],

    // ─── Tags ─────────────────────────────────────────────────────────────────
    tags: [
      {
        name: "Auth",
        description:
          "Authentication — email/password signup & signin (client-side via Supabase SDK), Google OAuth PKCE callback, and logout. The signup and signin forms live at `/signup` and `/login`.",
      },
      {
        name: "User",
        description: "Current authenticated user",
      },
      {
        name: "YouTube",
        description: "YouTube OAuth connection and channel analytics",
      },
    ],

    // ─── Paths ────────────────────────────────────────────────────────────────
    paths: {

      // ── Auth ────────────────────────────────────────────────────────────────

      "/api/auth/callback": {
        get: {
          tags: ["Auth"],
          summary: "OAuth PKCE callback",
          description: `
Handles the redirect from Supabase after Google authenticates the user.

**Flow:**
1. Google → Supabase (\`http://127.0.0.1:54321/auth/v1/callback\`)
2. Supabase → this endpoint (\`/api/auth/callback?code=...\`)
3. \`exchangeCodeForSession(code)\` completes the PKCE exchange
4. Session cookies are written onto the response
5. Browser is redirected to the dashboard (\`/\`)

This endpoint is called automatically by the OAuth flow — it is not called directly by your application code.
          `.trim(),
          parameters: [
            {
              name: "code",
              in: "query",
              required: false,
              description: "Short-lived PKCE authorization code from Supabase",
              schema: { type: "string" },
            },
            {
              name: "next",
              in: "query",
              required: false,
              description: "Path to redirect to after successful login (default: /)",
              schema: { type: "string", example: "/" },
            },
            {
              name: "error",
              in: "query",
              required: false,
              description: "OAuth error code if the user denied access or an error occurred",
              schema: { type: "string", example: "access_denied" },
            },
            {
              name: "error_description",
              in: "query",
              required: false,
              description: "Human-readable description of the OAuth error",
              schema: { type: "string" },
            },
          ],
          responses: {
            "302": {
              description: "Redirect — either to dashboard on success, or to /login?error=... on failure",
              headers: {
                Location: {
                  schema: { type: "string" },
                  description: "Dashboard URL on success, login URL with error on failure",
                },
                "Set-Cookie": {
                  schema: { type: "string" },
                  description: "Supabase session cookies (sb-access-token, sb-refresh-token)",
                },
              },
            },
          },
        },
      },

      "/api/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Sign out",
          description:
            "Invalidates the current Supabase session server-side and clears session cookies. Redirects to `/login`.",
          responses: {
            "302": {
              description: "Redirect to /login after session is cleared",
              headers: {
                Location: {
                  schema: { type: "string", example: "http://127.0.0.1:3000/login" },
                },
              },
            },
          },
        },
      },

      // ── User ────────────────────────────────────────────────────────────────

      "/api/me": {
        get: {
          tags: ["User"],
          summary: "Get current user",
          description:
            "Returns the authenticated user from the active session cookie. Returns `{ user: null }` if not logged in — does not return 401.",
          security: [{ sessionCookie: [] }],
          responses: {
            "200": {
              description: "Authenticated user object, or null if no active session",
              content: {
                "application/json": {
                  schema: {
                    oneOf: [
                      {
                        type: "object",
                        properties: {
                          user: { $ref: "#/components/schemas/User" },
                        },
                        required: ["user"],
                      },
                      {
                        type: "object",
                        properties: {
                          user: { type: "null" },
                        },
                        required: ["user"],
                      },
                    ],
                  },
                  examples: {
                    authenticated: {
                      summary: "Logged-in user",
                      value: {
                        user: {
                          id: "a1b2c3d4-0000-0000-0000-000000000000",
                          email: "creator@example.com",
                          created_at: "2026-05-01T10:00:00Z",
                        },
                      },
                    },
                    unauthenticated: {
                      summary: "No active session",
                      value: { user: null },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ── YouTube OAuth ────────────────────────────────────────────────────────

      "/api/oauth/youtube": {
        get: {
          tags: ["YouTube"],
          summary: "Initiate YouTube OAuth",
          description: `
Starts the YouTube connect flow. Verifies the user is logged into Tether, then redirects to Google's OAuth consent screen requesting \`youtube.readonly\` scope.

**Required Google Cloud Console setup:**
The redirect URI \`http://127.0.0.1:3000/api/oauth/youtube/callback\` must be added to your OAuth 2.0 client's Authorised redirect URIs.

**Why \`prompt=consent\` + \`access_type=offline\`?**
Google only sends a \`refresh_token\` on the very first consent. Forcing the consent screen every time ensures a refresh token is always returned, even if the user has connected before.
          `.trim(),
          security: [{ sessionCookie: [] }],
          responses: {
            "302": {
              description: "Redirect to Google's OAuth consent screen",
              headers: {
                Location: {
                  schema: {
                    type: "string",
                    example:
                      "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&scope=https://www.googleapis.com/auth/youtube.readonly&...",
                  },
                },
              },
            },
            "302 (unauthenticated)": {
              description: "Redirect to /login if user is not logged into Tether",
            },
          },
        },
      },

      "/api/oauth/youtube/callback": {
        get: {
          tags: ["YouTube"],
          summary: "YouTube OAuth callback",
          description: `
Google redirects here after the user grants (or denies) YouTube access.

**On success:**
1. Exchanges the authorization code for access + refresh tokens
2. Fetches the user's YouTube channel info (name, handle, thumbnail, uploads playlist ID)
3. Encrypts both tokens with AES-256-GCM before storing
4. Upserts the row into \`platform_tokens\` (unique on \`user_id + platform\`)
5. Redirects to dashboard with \`?youtube_connected=true\`

**On error:** Redirects to dashboard with \`?youtube_error=...\`

This endpoint is called automatically by the OAuth flow.
          `.trim(),
          parameters: [
            {
              name: "code",
              in: "query",
              required: false,
              description: "Authorization code from Google",
              schema: { type: "string" },
            },
            {
              name: "error",
              in: "query",
              required: false,
              description: "Error code if the user denied access (e.g. `access_denied`)",
              schema: { type: "string" },
            },
          ],
          security: [{ sessionCookie: [] }],
          responses: {
            "302": {
              description:
                "Redirect to dashboard — `?youtube_connected=true` on success, `?youtube_error=...` on failure",
              headers: {
                Location: {
                  schema: {
                    type: "string",
                    examples: [
                      "http://127.0.0.1:3000/?youtube_connected=true",
                      "http://127.0.0.1:3000/?youtube_error=access_denied",
                    ],
                  },
                },
              },
            },
          },
        },
      },

      // ── YouTube Stats ────────────────────────────────────────────────────────

      "/api/youtube/stats": {
        get: {
          tags: ["YouTube"],
          summary: "Get YouTube channel stats",
          description: `
Returns the authenticated user's YouTube channel statistics and most recent videos.

**Token lifecycle:**
- Decrypts the stored access token
- If the token expires within 5 minutes, it is automatically refreshed using the stored refresh token and the new token is persisted
- If no refresh token is available, returns 401 with a reconnect prompt

**YouTube Data API quota cost:**
- \`channels.list\` — 1 unit
- \`playlistItems.list\` — 0 units
- \`videos.list\` — 1 unit

**Total: ~2 units per call** (vs. 100+ for \`search.list\`)
          `.trim(),
          security: [{ sessionCookie: [] }],
          responses: {
            "200": {
              description: "Channel stats and recent videos",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/YouTubeStatsResponse" },
                  example: {
                    channel: {
                      id: "UCxxxxxxxxxxxxxxxxxxxxxx",
                      name: "My Creator Channel",
                      handle: "@mycreator",
                      thumbnail: "https://yt3.ggpht.com/example.jpg",
                      subscribers: 124500,
                      totalViews: 8320000,
                      videoCount: 312,
                      uploadsPlaylistId: "UUxxxxxxxxxxxxxxxxxxxxxx",
                    },
                    videos: [
                      {
                        id: "dQw4w9WgXcQ",
                        title: "My Latest Video",
                        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
                        publishedAt: "2026-04-28T14:00:00Z",
                        views: 42300,
                        likes: 1850,
                        comments: 234,
                      },
                    ],
                    connectedAt: "2026-05-01T10:30:00Z",
                  },
                },
              },
            },
            "401": {
              description: "Not logged in, or token expired with no refresh token available",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  examples: {
                    unauthorized: {
                      value: { error: "Unauthorized" },
                    },
                    tokenExpired: {
                      value: {
                        error:
                          "Token expired and no refresh token available. Please reconnect YouTube.",
                      },
                    },
                    refreshFailed: {
                      value: { error: "Token refresh failed: invalid_grant" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "YouTube has not been connected for this user",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  example: { error: "YouTube not connected" },
                },
              },
            },
            "500": {
              description: "Unexpected error fetching data from YouTube API",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/ErrorResponse" },
                  example: { error: "No YouTube channel found for this account" },
                },
              },
            },
          },
        },
      },
    },

    // ─── Components ───────────────────────────────────────────────────────────
    components: {
      securitySchemes: {
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "sb-access-token",
          description:
            "Supabase session cookie. Set automatically after completing the Google OAuth PKCE login flow. Include cookies in your requests (browser does this automatically).",
        },
      },

      schemas: {

        // ── User ──────────────────────────────────────────────────────────────
        User: {
          type: "object",
          description: "Supabase Auth user object (subset of fields)",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Supabase user UUID",
              example: "a1b2c3d4-0000-0000-0000-000000000000",
            },
            email: {
              type: "string",
              format: "email",
              example: "creator@example.com",
            },
            created_at: {
              type: "string",
              format: "date-time",
              example: "2026-05-01T10:00:00Z",
            },
          },
          required: ["id", "email"],
        },

        // ── YouTube ───────────────────────────────────────────────────────────
        ChannelStats: {
          type: "object",
          description: "YouTube channel information and aggregate statistics",
          properties: {
            id: {
              type: "string",
              description: "YouTube channel ID",
              example: "UCxxxxxxxxxxxxxxxxxxxxxx",
            },
            name: {
              type: "string",
              description: "Channel display name",
              example: "My Creator Channel",
            },
            handle: {
              type: "string",
              description: "Channel handle (e.g. @mycreator). Empty string if not set.",
              example: "@mycreator",
            },
            thumbnail: {
              type: "string",
              format: "uri",
              description: "URL of the channel's profile thumbnail",
              example: "https://yt3.ggpht.com/example.jpg",
            },
            subscribers: {
              type: "integer",
              description: "Subscriber count",
              example: 124500,
            },
            totalViews: {
              type: "integer",
              description: "Lifetime total view count across all videos",
              example: 8320000,
            },
            videoCount: {
              type: "integer",
              description: "Total number of public videos",
              example: 312,
            },
            uploadsPlaylistId: {
              type: "string",
              description: "YouTube playlist ID for the channel's uploads. Used internally for fetching recent videos.",
              example: "UUxxxxxxxxxxxxxxxxxxxxxx",
            },
          },
          required: ["id", "name", "handle", "thumbnail", "subscribers", "totalViews", "videoCount", "uploadsPlaylistId"],
        },

        VideoSummary: {
          type: "object",
          description: "Summary statistics for a single YouTube video",
          properties: {
            id: {
              type: "string",
              description: "YouTube video ID",
              example: "dQw4w9WgXcQ",
            },
            title: {
              type: "string",
              description: "Video title",
              example: "My Latest Video",
            },
            thumbnail: {
              type: "string",
              format: "uri",
              description: "Medium-quality thumbnail URL",
              example: "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            },
            publishedAt: {
              type: "string",
              format: "date-time",
              description: "ISO 8601 publish timestamp",
              example: "2026-04-28T14:00:00Z",
            },
            views: {
              type: "integer",
              description: "Total view count",
              example: 42300,
            },
            likes: {
              type: "integer",
              description: "Total like count",
              example: 1850,
            },
            comments: {
              type: "integer",
              description: "Total comment count",
              example: 234,
            },
          },
          required: ["id", "title", "thumbnail", "publishedAt", "views", "likes", "comments"],
        },

        YouTubeStatsResponse: {
          type: "object",
          description: "Response from GET /api/youtube/stats",
          properties: {
            channel: {
              $ref: "#/components/schemas/ChannelStats",
            },
            videos: {
              type: "array",
              description: "Most recent videos (up to 5)",
              items: { $ref: "#/components/schemas/VideoSummary" },
            },
            connectedAt: {
              type: "string",
              format: "date-time",
              description: "When the user first connected their YouTube account",
              example: "2026-05-01T10:30:00Z",
            },
          },
          required: ["channel", "videos", "connectedAt"],
        },

        // ── Errors ────────────────────────────────────────────────────────────
        ErrorResponse: {
          type: "object",
          description: "Standard error envelope returned by all JSON error responses",
          properties: {
            error: {
              type: "string",
              description: "Human-readable error message",
              example: "Unauthorized",
            },
          },
          required: ["error"],
        },
      },
    },
  };
}
