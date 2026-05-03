# tether-backend — Context

Next.js 15 App Router app running on **port 3000**. Pure API server — no pages, no UI. All routes live under `/api/`. The frontend (port 3001) calls these endpoints with `Authorization: Bearer <supabase_jwt>` headers.

## Authentication Pattern

Two clients are used depending on context:

| Client | Key | Used for |
|---|---|---|
| `adminClient` (`lib/supabase.ts`) | Service-role key | All DB reads/writes (bypasses RLS) |
| `createSupabaseServerClient()` (`lib/supabaseServer.ts`) | Anon key + cookies | Auth callback route only |

All API routes authenticate via `getUserFromBearer(authHeader)`:
```typescript
// lib/supabaseServer.ts
export async function getUserFromBearer(authHeader: string | null): Promise<User | null>
// Verifies the JWT against Supabase auth server, returns user or null
```

## API Routes

### Auth
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/auth/callback` | PKCE code exchange (Supabase session setup) |
| POST | `/api/auth/logout` | Sign out, clear cookies |

### Profile
| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/profile` | Bearer | Get own profile + email |
| PUT | `/api/profile` | Bearer | Upsert profile fields |
| GET | `/api/profile/check-username` | Bearer | Check if username is available |

`PUT /api/profile` allowed fields: `username`, `full_name`, `bio`, `website`, `avatar_url`, `creator_stage`, `aspiration`, `platform_reason`, `metric_visibility`

`GET /api/profile/check-username?username=xxx` returns `{ available: boolean, error?: string }`. Returns `available: true` if the username is unclaimed or already owned by the requesting user.

### YouTube
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/oauth/youtube` | Bearer | Returns Google consent URL |
| GET | `/api/oauth/youtube/callback` | none (signed state) | Exchanges code, stores encrypted tokens |
| GET | `/api/youtube/stats` | Bearer | Fetch channel stats + recent videos. Writes metric_snapshot. |

### Instagram
| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/oauth/instagram` | Bearer | Returns Facebook consent URL |
| GET | `/api/oauth/instagram/callback` | none (signed state) | Exchanges code, gets long-lived token, stores encrypted tokens |

Instagram requires `INSTAGRAM_CLIENT_ID` + `INSTAGRAM_CLIENT_SECRET`. Returns `503` if not configured.

### Public
| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/creators/:username` | none | Public profile + platforms + metric_visibility |
| GET | `/api/me` | Bearer | Current user id + email |
| GET | `/api/docs` | none | OpenAPI 3.0.3 spec JSON |

## Database Schema

### `profiles`
```sql
id               UUID PK  -- matches auth.users.id
username         TEXT UNIQUE
full_name        TEXT
bio              TEXT
website          TEXT
avatar_url       TEXT
creator_stage    TEXT     -- 'just_starting' | 'growing' | 'established' | 'pro'
aspiration       TEXT
platform_reason  TEXT
metric_visibility JSONB   -- { subscribers, total_views, video_count, avg_views, view_chart, recent_videos }
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ  -- auto-updated by trigger
```
RLS: public SELECT, owner-only INSERT/UPDATE/DELETE.

### `platform_tokens`
```sql
id                UUID PK
user_id           UUID FK → auth.users
platform          TEXT     -- 'youtube' | 'instagram'
access_token      TEXT     -- AES-256-GCM encrypted
refresh_token     TEXT     -- AES-256-GCM encrypted (nullable)
token_expiry      TIMESTAMPTZ
scope             TEXT
platform_user_id  TEXT     -- YouTube channel ID / Instagram account ID
platform_username TEXT     -- display name
metadata          JSONB    -- platform-specific (see below)
created_at        TIMESTAMPTZ
updated_at        TIMESTAMPTZ  -- auto-updated by trigger
UNIQUE (user_id, platform)
```
YouTube `metadata`: `{ handle, thumbnail, uploadsPlaylistId }`
Instagram `metadata`: `{ username, followers_count, media_count, profile_picture_url }`

RLS: public SELECT (tokens are encrypted ciphertext), owner-only write.

### `metric_snapshots`
```sql
id          UUID PK
user_id     UUID FK → auth.users (CASCADE DELETE)
platform    TEXT        -- 'youtube'
data        JSONB       -- { channel: ChannelStats, videos: VideoSummary[] }
captured_at TIMESTAMPTZ -- DEFAULT now()
INDEX ON (user_id, platform, captured_at DESC)
```
Written on every call to `GET /api/youtube/stats` (fire-and-forget, non-blocking).
Also written by the daily Edge Function cron job.

RLS: owner-only SELECT, no client INSERT policy (server uses service-role key).

## Token Encryption (`lib/encryption.ts`)

Format stored in DB: `iv_hex:authTag_hex:ciphertext_hex`

```
key = SHA-256(ENCRYPTION_SECRET)   → 32 bytes
algorithm = AES-256-GCM
iv = 16 random bytes per encrypt call
```

The Deno edge function re-implements this using the Web Crypto API to match exactly.

## YouTube OAuth (`lib/youtube.ts`)

- Signed state: `base64url(JSON({ userId, ts, sig }))` where `sig = HMAC-SHA256(userId:ts)`
- State expires after 10 minutes
- Callback verifies state → extracts userId without needing a session cookie
- `GET /api/youtube/stats` auto-refreshes the access token when < 5 minutes remain
- Scopes: `youtube.readonly`

## Instagram OAuth (`lib/instagram.ts`)

- Same signed state pattern as YouTube (suffix `:instagram` in HMAC input to prevent cross-platform reuse)
- Uses Facebook Graph API v21.0 OAuth
- Short-lived token → exchanged for 60-day long-lived token
- Resolves Instagram business account via Facebook Pages → Instagram Business Account lookup
- Requires a Professional Instagram account linked to a Facebook Page

## CORS (`middleware.ts`)

Dynamic CORS — checks `origin` against an allowlist:
```
ALLOWED_ORIGINS = { FRONTEND_URL, http://127.0.0.1:3001, http://localhost:3001 }
```
Handles OPTIONS preflight. Re-applies headers after `setAll()` may replace the response object.

## Edge Function: `daily-snapshot`

Located at `supabase/functions/daily-snapshot/index.ts`. Runs as Deno.

**Trigger**: pg_cron job fires at 00:05 UTC daily via `pg_net` HTTP POST.
**Auth**: `Authorization: Bearer <CRON_SECRET>` (JWT verification disabled — not a user request).

**Flow per user**:
1. Load all `platform_tokens` where `platform = 'youtube'`
2. Decrypt access token (Web Crypto AES-256-GCM)
3. Auto-refresh if expiring within 10 minutes
4. Fetch channel stats + recent 5 videos from YouTube Data API v3
5. Insert row into `metric_snapshots`

Errors per user are caught and logged — one failure does not stop other users.

**Test locally**:
```bash
supabase functions serve daily-snapshot --env-file supabase/.env.local --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/daily-snapshot \
  -H "Authorization: Bearer tether_cron_secret_local" \
  -H "Content-Type: application/json" -d '{}'
```

## Config (`lib/config.ts`)

Single source of truth for all URLs and constants. Never hardcode strings elsewhere.

```typescript
APP_URL      = NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000"
FRONTEND_URL = FRONTEND_URL        ?? "http://127.0.0.1:3001"

routes.youtubeCallback   = APP_URL + /api/oauth/youtube/callback
routes.instagramCallback = APP_URL + /api/oauth/instagram/callback

platforms.YOUTUBE   = "youtube"
platforms.INSTAGRAM = "instagram"

youtube.scopes = "https://www.googleapis.com/auth/youtube.readonly"
youtube.maxRecentVideos = 5

instagram.scopes = "instagram_basic,pages_read_engagement,business_management"
```

## Migrations (in order)

| File | What it does |
|---|---|
| `20260501162942_init_schema.sql` | Creates `profiles` table + RLS + updated_at trigger |
| `20260502000001_create_platform_tokens.sql` | Creates `platform_tokens` table + RLS + trigger |
| `20260503000001_add_metric_visibility.sql` | Adds `metric_visibility` JSONB column to profiles |
| `20260503000002_create_metric_snapshots.sql` | Creates `metric_snapshots` table + index + RLS |
| `20260503000003_schedule_daily_snapshot.sql` | Enables pg_cron + pg_net, schedules daily job at 00:05 UTC |
