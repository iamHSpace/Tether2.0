# Statvora — Architecture

## Overview

Statvora is a creator intelligence platform. Creators connect their social accounts (YouTube, Instagram) to get a unified analytics dashboard. They receive a verified public profile link they can share with brands and agencies — real-time, tamper-proof metrics instead of screenshots.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  tether-frontend (Next.js 15)  statvora.in                  │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ /dashboard│  │/discover   │  │/c/:handle│  │/admin/*  │  │
│  │ (creator) │  │(business)  │  │(public)  │  │(admin)   │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │ fetch / Supabase Realtime
┌──────────────────────▼──────────────────────────────────────┐
│               tether-backend (Next.js 15)                   │
│               api.statvora.in                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Auth /   │  │YouTube / │  │ Business │  │  Admin   │    │
│  │ Profile  │  │Instagram │  │ Portal   │  │  Panel   │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└──────────┬────────────┬──────────────────────────────────────┘
           │            │ HTTP (YouTube Data API v3 /
           │            │       Meta Graph API)
┌──────────▼──────┐  ┌──▼──────────────────────────────────┐
│   Supabase      │  │  External APIs                      │
│   Postgres      │  │  - Google / YouTube                 │
│   Auth          │  │  - Meta / Instagram                 │
│   Realtime      │  │  - Stripe                           │
│   Edge Functions│  │  - ip-api.com (geo)                 │
└─────────────────┘  └─────────────────────────────────────┘
```

---

## Applications

### `tether-frontend` — `statvora.in`

Next.js 15 App Router, deployed on Vercel (`statvora-frontend`, `prj_7bF4HTZL1AATeT9CXOpAcXdpDX9I`).

Serves all roles on a single domain with middleware-based route guards. No API routes except for the Google OAuth code exchange (`/api/auth/google/code`) and the Google OAuth completion page (`/auth/google/complete`).

**Rendering strategy:**

| Page | Strategy | Why |
|---|---|---|
| `/c/:username` | RSC + ISR (`revalidate = 300`) | Public, SEO-critical, cacheable |
| `/dashboard` | Client component (`"use client"`) | Live data, Realtime subscription |
| `/discover` | Client component | Search/filter state |
| `/admin/*` | Client components | Dynamic, paginated tables |
| `/pricing` | Client component | Stripe checkout integration |
| `/docs` | Client component | Swagger UI |

**Key frontend libraries:**
- `@supabase/supabase-js` — auth and Realtime messaging
- `recharts` — analytics charts
- `tailwind-merge` — class merging utility
- No external UI component library; all components are custom

### `tether-backend` — `api.statvora.in`

Next.js 15 App Router (API-only), deployed on Vercel (`statvora-backend`, `prj_DwCyPlnCTFDbE3vGTnowRTboTynv`).

All API routes are under `app/api/`. No pages. CORS is handled in `middleware.ts` which reads `FRONTEND_URL` env var.

---

## Request Flow Examples

### Creator loads dashboard

```
1. Browser → supabase.auth.getUser()           [Supabase Auth]
2. Browser → GET /api/profile                  [backend]
   - Returns profile row + email
3. Browser → GET /api/youtube/stats            [backend]
   - Decrypt YouTube token
   - YouTube Data API: channels.list + playlistItems.list + videos.list (parallelised, capped at 100 videos)
   - INSERT metric_snapshots (fire-and-forget)
   - UPDATE profiles.last_active_at
   - Return channel + videos JSON
4. Browser → GET /api/instagram/stats          [backend] (parallel with step 3)
   - Decrypt Instagram token, check expiry
   - Graph API: /{ig_user_id} + /{ig_user_id}/media
   - INSERT metric_snapshots (fire-and-forget)
   - Return account + posts JSON
5. Browser → GET /api/profile/views            [backend]
   - Calls get_creator_view_stats() Postgres RPC
   - Returns weekly + daily view counts
```

### Business discovers a creator

```
1. Browser → GET /api/business/discover?q=fitness&sort=subscribers [backend]
   - Joins profiles + platform_tokens (token existence check) + metric_snapshots
   - pg_trgm GIN index used for ILIKE search
   - Returns paginated creator list with latest snapshot data
2. Business clicks Save:
   Browser → POST /api/business/saved-creators  [backend]
   - INSERT saved_creators (UNIQUE constraint prevents duplicates)
3. Business views /saved:
   Browser → GET /api/business/saved-creators         [backend]
   Browser → GET /api/business/saved-creators/batch   [backend]
   - Single DB query for all profiles + snapshots
   - Returns Record<username, CreatorResponse>
```

### Creator public profile visit

```
1. Request hits Vercel CDN
   - If ISR cache fresh (< 5 min since last revalidate): serve static HTML
   - If stale: Vercel calls Next.js RSC render
2. RSC render:
   - GET /api/creators/:username (backend, Cache-Control: s-maxage=300)
   - Returns profile + platforms + latest snapshots (via get_latest_snapshots RPC)
3. TrackView client island fires (invisible):
   - POST /api/track/view  [backend]
   - ip-api.com geolocation lookup (server-side)
   - INSERT page_views + profile_views
```

---

## Authentication

### Session auth (browser sessions)

All frontend → backend API calls include the Supabase session JWT in the `Authorization: Bearer <token>` header.

Backend routes call `getUserFromBearer(authHeader)` (`lib/supabaseServer.ts`) which calls `supabase.auth.getUser(token)` against Supabase — this verifies the JWT signature and returns the user object.

**No `getSession()` is used** — always `getUser()` to prevent session spoofing.

### API key auth (developer API)

Business users can create API keys via `/settings → Developer`. Keys are `tth_` + 32 random bytes hex (68 chars total). Only the SHA-256 hash is stored in `api_keys`. The raw key is shown once at creation.

API key routes use `requireApiKey(authHeader)` (`lib/apiKeyGuard.ts`), which:
1. Strips `tth_` prefix
2. SHA-256 hashes the key
3. Looks up `api_keys` table by hash where `is_active = true` and `expires_at > now()`
4. Updates `last_used_at` fire-and-forget

### Role and admin guards

| Guard | How |
|---|---|
| Route guard (middleware) | Reads `user.user_metadata.user_type` and `user.user_metadata.is_admin` from JWT — zero DB calls |
| Admin API routes | `requireAdmin()` in `lib/adminGuard.ts` — verifies JWT then checks `profiles.is_admin = true` in DB |
| Suspension | Middleware reads `user.user_metadata.is_suspended`; suspended users redirect to `/suspended` |

---

## OAuth Flows

### Google / YouTube OAuth

```
Signup/login (frontend):
  → Build Google OAuth URL (scope: openid email profile youtube.readonly)
  → Redirect to Google

Google redirects to /api/auth/google/code (frontend):
  → Exchange code with Google token endpoint (GOOGLE_CLIENT_SECRET, server-side)
  → supabase.auth.signInWithIdToken({ provider: "google", token: id_token })
  → Redirect to /auth/google/complete

/auth/google/complete (client component):
  → Read _pending_user_type from localStorage
  → supabase.auth.updateUser({ data: { user_type, full_name } })
  → PUT /api/profile (persist profile row)
  → Clear localStorage keys
  → Redirect to /onboarding (creator) or /discover (business)

YouTube Connect (separate, creator only):
  → POST /api/oauth/youtube → returns Google consent URL
  → User grants youtube.readonly scope
  → GET /api/oauth/youtube/callback (backend)
  → AES-256-GCM encrypt access+refresh tokens
  → INSERT platform_tokens (user_id, platform='youtube', encrypted_token)
```

### Instagram OAuth

```
  → POST /api/oauth/instagram → returns Instagram consent URL
    (www.instagram.com/oauth/authorize, App ID: 1533963551672841)
  → User grants instagram_business_basic scope
  → GET /api/oauth/instagram/callback (backend)
  → POST api.instagram.com/oauth/access_token (short-lived token)
  → GET graph.instagram.com/access_token (long-lived token, ~60 days)
  → GET graph.instagram.com/v21.0/me (get ig_user_id)
  → AES-256-GCM encrypt long-lived token
  → INSERT platform_tokens (user_id, platform='instagram', encrypted_token, token_metadata={ig_user_id})
```

---

## Data Storage

### Token encryption

```
key      = SHA-256(ENCRYPTION_SECRET)  →  32 bytes
algorithm = AES-256-GCM
IV        = 16 random bytes (generated per encryption)
stored as: iv_hex:authTag_hex:ciphertext_hex
```

OAuth state parameter is HMAC-SHA256 signed (`userId:timestamp`) and verified on callback. Expires after 10 minutes.

### Snapshots

`metric_snapshots` table stores a snapshot per creator per platform per day. Shape:

**YouTube:** `{ channel: { subscribers, totalViews, videoCount, title, ... }, videos: [...] }`

**Instagram:** `{ account: { id, username, name, followers_count, media_count }, posts: [...] }`

The `get_latest_snapshots(p_user_id)` Postgres RPC uses `DISTINCT ON (platform)` to return the most recent snapshot per platform without in-memory deduplication.

---

## Real-time Messaging

Messages use Supabase Realtime (Postgres CDC). Each `/messages` page subscribes to:

```
supabase.channel('messages-<conversation_id>')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.<id>` })
  .subscribe()
```

New messages are inserted via `POST /api/conversations/:id/messages`. RLS ensures only conversation participants can read/write.

---

## Background Jobs

### Daily Snapshot (00:05 UTC)

Supabase Edge Function (`supabase/functions/daily-snapshot/`) triggered by `pg_cron` via `pg_net` HTTP POST.

```
For each creator where last_active_at >= now() - 30 days:
  1. Fetch platform_tokens (youtube)
  2. Decrypt token
  3. If token expires in < 10 min: refresh via YouTube token endpoint
  4. Fetch channel stats + 5 recent videos (YouTube Data API)
  5. INSERT metric_snapshots { platform: 'youtube', data: { channel, videos } }
```

Creators inactive for > 30 days are skipped to preserve YouTube API quota.

---

## CORS Policy

Backend `middleware.ts` sets `Access-Control-Allow-Origin` from the `FRONTEND_URL` env var. Both `http://127.0.0.1:3001` (local) and `https://statvora.in` (production) are permitted simultaneously.

---

## CI/CD

`.github/workflows/deploy.yml` runs two parallel Vercel deploy jobs on every push to `main`. Each job runs `vercel deploy --prod` using project-specific tokens stored as GitHub secrets.

```
Secrets: VERCEL_TOKEN, VERCEL_ORG_ID
         VERCEL_PROJECT_ID_FRONTEND (prj_7bF4HTZL1AATeT9CXOpAcXdpDX9I)
         VERCEL_PROJECT_ID_BACKEND  (prj_DwCyPlnCTFDbE3vGTnowRTboTynv)
```

---

## Performance Characteristics

| Bottleneck | Fix applied |
|---|---|
| YouTube API sequential pagination | Capped at 100 videos; parallel chunk fetches with `Promise.all` |
| Sequential profile + stats loads | Parallelised with `Promise.allSettled` |
| N+1 saved creator enrichment | Batch endpoint returns `Record<username, CreatorResponse>` in 1 query |
| Discover text search full-table scan | `pg_trgm` GIN indexes on `username` + `full_name` |
| In-memory views aggregation | Pushed to Postgres `get_creator_view_stats()` RPC |
| Snapshot deduplication in-memory | `DISTINCT ON (platform)` Postgres RPC |
| Public profile cold load | ISR (5 min revalidate) + `Cache-Control: s-maxage=300` on backend |
| Profile views DB queries sequential | Parallelised with `Promise.all` |

---

## Tech Stack Summary

| Concern | Technology |
|---|---|
| Framework | Next.js 15, App Router |
| Language | TypeScript (strict) |
| Database | Supabase Postgres |
| Auth | Supabase Auth + custom Google OAuth flow |
| Real-time | Supabase Realtime (Postgres CDC) |
| Styling | Tailwind CSS 3.4, custom design tokens |
| Charts | Recharts |
| Payments | Stripe (Checkout + Customer Portal + Webhooks) |
| Edge functions | Supabase Edge Functions (Deno) |
| Cron | Supabase pg_cron + pg_net |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Geolocation | ip-api.com (server-side, on page view track) |
| Deployment | Vercel (separate projects for frontend + backend) |
| CI/CD | GitHub Actions |
