# Tether 2.0 — Project Context

Creator intelligence platform. Creators connect social accounts, get a unified analytics dashboard, and share a verified metrics link with brands/agencies — no screenshots, no manual reports.

---

## Feature inventory

### Creator features
| Feature | Where |
|---|---|
| Email signup / Google OAuth | `/signup`, `/login` |
| Multi-step onboarding wizard | `/onboarding` |
| Connect YouTube account (OAuth, auto-refresh tokens) | Dashboard → Connect YouTube |
| Connect Instagram account (OAuth, long-lived token) | Dashboard → Connect Instagram |
| YouTube analytics dashboard (subscribers, total views, video count, avg views, recent videos) | `/dashboard` |
| Metric visibility toggles (choose what businesses can see on public profile) | `/dashboard` |
| Profile view stats widget (this week / last week / all time + 7-day daily chart) | `/dashboard` |
| Shareable verified public profile link `/c/:username` | `/dashboard` |
| Edit profile (username, full name, bio, website, avatar URL, category, creator stage) | `/settings` |
| Browse & search business profiles | `/businesses` |
| Real-time messaging with businesses | `/messages` |
| Daily automated YouTube snapshot (metrics stored for history) | Background cron 00:05 UTC |

### Business features
| Feature | Where |
|---|---|
| Email signup / Google OAuth | `/signup`, `/login` |
| Discover creators — search by name, filter by category, stage, subscriber range, avg views | `/discover` |
| Save / unsave creators (bookmarked list) | `/discover`, `/saved` |
| Saved creator list with enriched live metrics | `/saved` |
| View creator public profiles | `/c/:username` |
| Real-time messaging with creators | `/messages` |
| Edit business profile (company name, bio, website, username) | `/settings` |
| Generate & revoke API keys (max 10 active) | `/settings` → Developer tab |
| Interactive API documentation | `/docs` |

### Developer features (business accounts with API keys)
| Feature | Endpoint |
|---|---|
| Search creator profiles with metrics | `GET /api/v1/creators` |
| Get own business profile | `GET /api/v1/me` |
| List own saved creators | `GET /api/v1/saved` |
| Update own business profile (company_name, bio, website) | `PATCH /api/v1/me` |
| Save a creator | `POST /api/v1/saved` |
| Unsave a creator | `DELETE /api/v1/saved` |

All write operations are scoped to the API key owner's `user_id` — cannot modify another organisation's records.

### Admin features (is_admin = true)
| Feature | Where |
|---|---|
| User table — search, filter by role/suspended, paginate | `/admin/users` |
| Suspend / unsuspend any user | `/admin/users` |
| Change user role or admin flag | `/admin/users` |
| Hard-delete a user | `/admin/users` |
| Platform health — per-creator YouTube token status, snapshot staleness | `/admin/health` |
| Manually trigger daily snapshot for all active creators | `/admin/health` |
| Platform analytics — total views, viewer type, top countries, device, referrer, daily chart (7/30/90d) | `/admin/analytics` |
| Moderate profiles (suspend/unsuspend) | `/admin/moderation` |
| Read-only conversation thread viewer | `/admin/moderation` |

### Public / unauthenticated features
| Feature | Where |
|---|---|
| View creator public profile (ISR, revalidates every 5 min) | `/c/:username` |
| API documentation (Swagger UI) | `/docs` |

---

## Repo layout

```
Tether2.0/
  tether-backend/    # Next.js 15 API-only app (port 3000) — all DB writes, YouTube/Instagram calls, edge functions
  tether-frontend/   # Next.js 15 fullstack app (port 3001) — single domain, all roles + admin panel
```

Both deployed on Vercel. Backend holds the Supabase service-role key (bypasses RLS). Frontend uses only the anon key in the browser.

---

## Role system

Three roles stored in `profiles.user_type` and mirrored in Supabase JWT `user_metadata`:

| Role | `user_type` | `is_admin` | Home page |
|---|---|---|---|
| Content creator | `'creator'` | false | `/dashboard` |
| Marketing/agency | `'business'` | false | `/discover` |
| Platform operator | either | **true** | `/admin/users` |

Role is embedded in JWT at signup:
```typescript
supabase.auth.signUp({ options: { data: { user_type: "creator" | "business" } } })
```

`is_admin` must be set manually — see "Promoting an admin" below.

**Middleware route guards (`tether-frontend/middleware.ts`):**
- `/dashboard`, `/onboarding`, `/businesses` → creator only; businesses bounced to `/discover`
- `/discover`, `/saved` → business only; creators bounced to `/dashboard`
- `/admin/*` → `is_admin: true` only; others bounced to their role home
- `/messages` → both roles
- `/suspended` → shown to users with `is_suspended: true`; can only sign out

---

## Frontend pages (`tether-frontend/app/`)

| Route | Who | Purpose |
|---|---|---|
| `/login` | Public | Email + Google OAuth; Creator/Business toggle |
| `/signup` | Public | Role picker → form (company_name field for business) |
| `/onboarding` | Creator | Multi-step profile setup wizard |
| `/dashboard` | Creator | YouTube analytics, metric visibility toggles, public profile link |
| `/businesses` | Creator | Browse & message business profiles |
| `/messages` | Both | Split-panel chat with Supabase Realtime |
| `/discover` | Business | Search/filter/save creator profiles |
| `/saved` | Business | Saved creator list with live enriched metrics |
| `/settings` | Both | Role-aware: creator → full_name; business → company_name |
| `/c/[username]` | Public | Creator public profile (ISR Server Component, revalidates every 5 min) |
| `/suspended` | Auth | Suspended users: sign-out only |
| `/admin/users` | Admin | Paginated user table; search, filter, suspend, delete |
| `/admin/health` | Admin | Per-creator YouTube token status + manual snapshot trigger |
| `/admin/analytics` | Admin | Platform-wide page_view breakdown (viewer type, geo, device, referrer, daily chart) |
| `/admin/moderation` | Admin | Suspend profiles; read-only conversation thread viewer |

**Styling:** Tailwind CSS 3.4, custom `brand-600` = `#7c3aed`. Component classes in `globals.css`: `.card`, `.btn-primary`, `.input`, `.sidebar-link`. No external UI library. Inter font via `next/font`.

---

## Auth flows

### Email signup
`supabase.auth.signUp()` with `options.data = { user_type }` → role embedded in JWT.

### Google OAuth (PKCE)
1. `supabase.auth.signInWithOAuth()` client-side → `redirectTo: origin + /api/auth/callback`
2. Browser → Google → back to `/api/auth/callback?code=...`
3. Server route exchanges code, stamps cookies, redirects to role home
4. `middleware.ts` validates session on every request via `supabase.auth.getUser()`

### Session management
- Always use `supabase.auth.getUser()` server-side — never `getSession()` alone
- Always use `127.0.0.1` not `localhost` locally — browsers treat them differently for cookies

---

## Backend API routes (`tether-backend/app/api/`)

### Auth
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/callback` | PKCE code exchange → session cookies |
| POST | `/api/auth/logout` | Sign out, clear cookies |
| GET | `/api/me` | Current user id + email |

### Profile
| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/profile` | Own profile (username, full_name, bio, website, avatar_url, creator_stage, aspiration, platform_reason, metric_visibility, company_name) |
| GET | `/api/profile/check-username` | `?username=x` → `{ available: boolean }` |
| GET | `/api/profile/views` | Creator view-count widgets (Postgres RPC — weekly/daily aggregates) |

### YouTube
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/oauth/youtube` | Returns Google consent URL |
| GET | `/api/oauth/youtube/callback` | Exchanges code, stores encrypted tokens |
| GET | `/api/youtube/stats` | Fetch channel stats + recent videos; writes `metric_snapshots`; touches `last_active_at` |

### Instagram
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/oauth/instagram` | Returns Facebook consent URL |
| GET | `/api/oauth/instagram/callback` | Exchanges code for long-lived token, stores encrypted |

Requires `INSTAGRAM_CLIENT_ID` + `INSTAGRAM_CLIENT_SECRET`. Returns `503` if not configured. Uses Facebook Graph API v21.0. Requires a Professional Instagram account linked to a Facebook Page.

### Creators & discovery
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/creators/:username` | Public profile + platforms + latest snapshots (no auth) |
| GET | `/api/business/discover` | Search creators with filters, sorting, pagination |
| GET/POST/DELETE | `/api/business/saved-creators` | Save/unsave creators |
| GET | `/api/business/saved-creators/batch` | Batch-enrich multiple saved creator profiles (1 query) |
| GET | `/api/creators/discover-businesses` | Creator browses business profiles |

### Messaging
| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/conversations` | List threads / start new (upserts on UNIQUE creator+business) |
| GET/POST | `/api/conversations/:id/messages` | Thread messages; GET marks incoming as read |

### Tracking
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/track/view` | Record `page_views` + legacy `profile_views` on `/c/:username` visit |

### Admin (all require `is_admin = true`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Platform totals: users, page views today/week/month, messages |
| GET | `/api/admin/users` | All profiles — search, filter by role/suspended, paginated |
| PUT | `/api/admin/users/:id` | Update `user_type`, `is_suspended`, `is_admin` |
| DELETE | `/api/admin/users/:id` | Hard-delete via `supabase.auth.admin.deleteUser` |
| GET | `/api/admin/platform-health` | Per-creator YT token status + snapshot staleness |
| POST | `/api/admin/snapshot/trigger` | Manually invoke the daily-snapshot edge function |
| GET | `/api/admin/analytics` | Aggregate `page_views`: viewer type, top countries, device, referrer, daily (7/30/90d) |
| GET | `/api/admin/conversations` | All conversations with last message preview, paginated |
| GET | `/api/admin/conversations/:id` | Full message thread (read-only) |
| PUT | `/api/admin/profiles/:id/flag` | Set/unset `is_suspended` |

**Admin guard:** `tether-backend/lib/adminGuard.ts` → `requireAdmin()` verifies JWT then checks `profiles.is_admin = true`.

### Developer API keys (session-authenticated)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/developer/keys` | List own API keys (prefix + metadata; never raw key) |
| POST | `/api/developer/keys` | Create key `{ name, expires_at? }` → returns raw key **once** |
| DELETE | `/api/developer/keys/:id` | Revoke key (sets `is_active = false`) |

Max 10 active keys per user.

### v1 Public API (API-key authenticated via `Authorization: Bearer tth_<key>`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/creators` | Search creators with metrics |
| GET | `/api/v1/me` | Own business profile |
| PATCH | `/api/v1/me` | Update own business profile (`company_name`, `bio`, `website` only) |
| GET | `/api/v1/saved` | List own saved creators |
| POST | `/api/v1/saved` | Save a creator `{ creator_username }` |
| DELETE | `/api/v1/saved` | Unsave a creator `{ creator_username }` |

**Ownership rule:** Every write is filtered by `userId` from `requireApiKey()`. A developer key can only modify records owned by that business — structurally impossible to touch another organisation's data.

**API key guard:** `tether-backend/lib/apiKeyGuard.ts` → `requireApiKey()` hashes the bearer token (SHA-256), looks up `api_keys` table, updates `last_used_at`.

Key format: `tth_` + 32 random bytes as hex (68 chars total). Only SHA-256 hash stored in DB.

---

## Database schema

### Tables

| Table | Purpose |
|---|---|
| `profiles` | All users (creators + businesses) |
| `platform_tokens` | AES-256-GCM encrypted OAuth tokens |
| `metric_snapshots` | Time-series YouTube stats per creator |
| `saved_creators` | Business bookmarks; UNIQUE(business_user_id, creator_username) |
| `conversations` | Creator ↔ business threads; UNIQUE(creator_id, business_id) |
| `messages` | Messages per conversation (body 1–2000 chars) |
| `profile_views` | Legacy view tracking; used by dashboard view-count widgets |
| `page_views` | Rich page-view analytics for `/c/:username` |
| `api_keys` | Developer API keys (hashed, prefix for display, per-user max 10) |

### `profiles` key columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | matches `auth.users.id` |
| `username` | text UNIQUE | |
| `full_name` | text | creator display name |
| `company_name` | text | business display name |
| `user_type` | text | `'creator'` \| `'business'` |
| `metric_visibility` | JSONB | `{ subscribers, total_views, video_count, avg_views, view_chart, recent_videos }` |
| `creator_stage` | text | `'just_starting'` \| `'growing'` \| `'established'` \| `'pro'` |
| `last_active_at` | timestamptz | touched on every `/api/youtube/stats` call; cron skips creators inactive >30d |
| `is_admin` | boolean | platform operator flag |
| `is_suspended` | boolean | suspended users see `/suspended` page |

### `platform_tokens` key columns

```
user_id, platform, access_token (encrypted), refresh_token (encrypted),
token_expiry, platform_user_id, platform_username, metadata (JSONB)
UNIQUE (user_id, platform)
```
YouTube `metadata`: `{ handle, thumbnail, uploadsPlaylistId }`
Instagram `metadata`: `{ username, followers_count, media_count, profile_picture_url }`

### Migrations (all in `tether-backend/supabase/migrations/`)

| File | What it does |
|---|---|
| `20260501162942_init_schema.sql` | `profiles` table, RLS, `updated_at` trigger |
| `20260502000001_create_platform_tokens.sql` | `platform_tokens`, RLS, trigger |
| `20260503000001_add_metric_visibility.sql` | `metric_visibility` JSONB on profiles |
| `20260503000002_create_metric_snapshots.sql` | `metric_snapshots`, index, RLS |
| `20260503000003_schedule_daily_snapshot.sql` | pg_cron + pg_net, daily job at 00:05 UTC |
| `20260504000001_business_portal.sql` | `user_type`, `saved_creators`, business RLS |
| `20260505000001_add_creator_category.sql` | `category` on profiles |
| `20260505000002_profile_views.sql` | `profile_views` table, RLS |
| `20260506000001_trgm_search_index.sql` | pg_trgm GIN indexes on username + full_name |
| `20260506000002_views_aggregate_rpc.sql` | `get_creator_view_stats()` Postgres RPC |
| `20260506000003_latest_snapshots_rpc.sql` | `get_latest_snapshots()` RPC |
| `20260506000004_platform_tokens_index.sql` | Index on `platform_tokens(user_id)` |
| `20260506000005_latest_snapshots_batch_rpc.sql` | Batch snapshots RPC |
| `20260506000006_company_name.sql` | `company_name` on profiles |
| `20260506000007_messaging.sql` | `conversations` + `messages`, RLS, Realtime |
| `20260507000001_last_active_at.sql` | `last_active_at` on profiles |
| `20260507000002_page_views.sql` | `page_views` table, composite indexes, RLS |
| `20260507000003_admin.sql` | `is_admin` + `is_suspended` on profiles |
| `20260507000004_api_keys.sql` | `api_keys` table (hash, prefix, active, expiry), RLS |

---

## Page-view tracking

Every visit to `/c/:username` fires `POST /api/track/view` from the `TrackView` client island (renders nothing, `useEffect` only).

**Data captured per view:**

| Field | Source |
|---|---|
| `viewer_type` | `'creator'` \| `'business'` \| `'anonymous'` |
| `country`, `region`, `city`, `timezone` | ip-api.com (free, no key, 2.5 s timeout, skips private IPs) |
| `device_type` | UA parse: `'mobile'` \| `'tablet'` \| `'desktop'` |
| `browser` | UA parse: Chrome / Firefox / Safari / Edge / Opera |
| `os` | UA parse: Windows / macOS / Android / iOS / iPadOS / ChromeOS / Linux |
| `language` | `Accept-Language` header first tag |
| `referrer_type` | `'direct'` \| `'search'` \| `'social'` \| `'internal'` \| `'other'` |
| `referrer_url` | `Referer` header (≤500 chars) |
| `user_agent` | raw UA (≤300 chars) |

Self-views excluded (`user.id === profile.id` → anonymous, no `viewer_id` written).
Legacy `profile_views` also gets a row (backward compat for dashboard view-count widgets).

**Analytics query pattern:** `page_views WHERE profile_id = :creator_id` with composite indexes on `(profile_id, viewer_type, viewed_at)`, `(profile_id, country, viewed_at)`, `(profile_id, device_type, viewed_at)`, `(profile_id, referrer_type, viewed_at)`.

---

## Token encryption (`tether-backend/lib/encryption.ts`)

Format stored in DB: `iv_hex:authTag_hex:ciphertext_hex`

```
key       = SHA-256(ENCRYPTION_SECRET)  →  32 bytes
algorithm = AES-256-GCM
iv        = 16 random bytes per encrypt call
```

The Deno edge function re-implements this using the Web Crypto API — same format.

---

## OAuth state signing (YouTube + Instagram)

```
state = base64url(JSON({ userId, ts, sig }))
sig   = HMAC-SHA256(userId:ts)          // YouTube
sig   = HMAC-SHA256(userId:ts:instagram) // Instagram (cross-platform prevention)
```
State expires after 10 minutes. Callback verifies state → extracts userId without needing a session cookie.

---

## Cron / edge functions

**`daily-snapshot`** (`tether-backend/supabase/functions/daily-snapshot/index.ts`):
- Triggered by pg_cron at 00:05 UTC via pg_net HTTP POST
- Auth: `Authorization: Bearer <CRON_SECRET>`
- Filters to creators with `last_active_at >= now() - 30 days` (skips dormant accounts to save YouTube API quota)
- Per creator: decrypt token → auto-refresh if expiring within 10 min → fetch channel stats + 5 recent videos → insert `metric_snapshots`
- Errors per user are caught and logged individually; one failure doesn't stop others
- Manual trigger: `POST /api/admin/snapshot/trigger` (admin only, 60 s timeout)

**Test locally:**
```bash
supabase functions serve daily-snapshot --env-file supabase/.env.local --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/daily-snapshot \
  -H "Authorization: Bearer tether_cron_secret_local"
```

---

## Key files

| File | Purpose |
|---|---|
| `tether-frontend/middleware.ts` | Route guards for all roles, admin, suspension |
| `tether-frontend/lib/api.ts` | Typed HTTP client for all backend calls incl. `api.admin.*` |
| `tether-frontend/components/layout/Sidebar.tsx` | Creator/business nav with unread message badge |
| `tether-frontend/components/layout/AdminSidebar.tsx` | Dark admin nav |
| `tether-frontend/app/c/[username]/_components/TrackView.tsx` | Invisible view-tracking client island |
| `tether-backend/lib/adminGuard.ts` | `requireAdmin()` — shared by all admin routes |
| `tether-backend/lib/encryption.ts` | AES-256-GCM encrypt/decrypt |
| `tether-backend/lib/config.ts` | Single source of truth for all URLs and platform constants |
| `tether-backend/lib/supabase.ts` | Service-role admin client |
| `tether-backend/lib/supabaseServer.ts` | `getUserFromBearer()` — JWT verification for API routes |
| `tether-backend/supabase/functions/daily-snapshot/index.ts` | Daily YouTube snapshot edge function |

---

## Local dev setup

### Prerequisites
- Node.js 18+, Docker Desktop, Supabase CLI (`npm i -g supabase`)
- Google Cloud project with OAuth 2.0 credentials

### 1. Start Supabase
```bash
supabase start   # from either subfolder — uses root supabase/
```

### 2. Backend `.env.local`
```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
ENCRYPTION_SECRET=<random string, min 32 chars>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
FRONTEND_URL=http://127.0.0.1:3001
CRON_SECRET=tether_cron_secret_local
```

### 3. Frontend `.env.local`
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3000
```

### 4. Google Cloud Console — add both redirect URIs
```
http://127.0.0.1:54321/auth/v1/callback      ← Supabase login
http://127.0.0.1:3000/api/oauth/youtube/callback  ← YouTube connect
```

### 5. Apply migrations and start
```bash
supabase db reset          # or: supabase migration up

# Terminal 1
cd tether-backend && npm run dev    # → http://127.0.0.1:3000

# Terminal 2
cd tether-frontend && npm run dev   # → http://127.0.0.1:3001
```

> Always use `127.0.0.1`, not `localhost` — browsers treat them differently for cookies.

---

## Promoting an admin (one-time)

```sql
UPDATE profiles SET is_admin = TRUE WHERE username = 'your-username';
```
Then in Supabase Dashboard → Auth → Users → edit the user → add to `user_metadata`:
```json
{ "is_admin": true }
```
User must re-login for the JWT to pick up the new flag. After that, `/admin` is accessible.
