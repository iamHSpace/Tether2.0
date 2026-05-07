# Tether — Project Context

## Repo layout

```
Tether2.0/
  tether-backend/    # Next.js 15 API-only app — all DB writes, YouTube calls, edge functions
  tether-frontend/   # Next.js 15 fullstack app — single domain, both roles + admin
```

Both deployed to Vercel. Backend holds the Supabase service-role key; frontend uses only the anon key in the browser.

---

## Role system

Three roles, all stored in `profiles.user_type` and mirrored in Supabase JWT `user_metadata`:

| Role | Value | Home page |
|---|---|---|
| Content creator | `'creator'` | `/dashboard` |
| Marketing/agency | `'business'` | `/discover` |
| Platform operator | `is_admin: true` | `/admin/users` |

Role is embedded in the JWT at signup: `supabase.auth.signUp({ options: { data: { user_type } } })`.  
`is_admin` must be set manually in both `profiles` table and `auth.users.user_metadata`.

**Middleware route guards (`tether-frontend/middleware.ts`):**
- `/dashboard`, `/onboarding`, `/businesses` → creator only
- `/discover`, `/saved` → business only
- `/admin/*` → `is_admin: true` only; others redirected to their role home
- `/messages` → both roles
- `/suspended` → shown to users with `is_suspended: true`

---

## Frontend pages

| Route | Who | Purpose |
|---|---|---|
| `/dashboard` | Creator | YouTube analytics, metric visibility toggles, public profile link |
| `/onboarding` | Creator | First-time profile setup |
| `/businesses` | Creator | Browse & message business profiles |
| `/messages` | Both | Split-panel chat, Supabase Realtime |
| `/discover` | Business | Search/filter/save creator profiles |
| `/saved` | Business | Saved creator list with live metrics |
| `/settings` | Both | Role-aware: creator → full_name; business → company_name |
| `/c/[username]` | Public | Creator public profile (ISR Server Component, revalidates every 5 min) |
| `/login` | Public | Creator/Business toggle, email + Google OAuth |
| `/signup` | Public | Role picker → form with company_name field for businesses |
| `/suspended` | Auth | Shown to suspended users; sign-out only |
| `/admin/users` | Admin | Paginated user table; search, filter, suspend, delete |
| `/admin/health` | Admin | Per-creator YouTube token status + manual snapshot trigger |
| `/admin/analytics` | Admin | Platform-wide page_view breakdown (viewer type, geo, device, referrer, daily chart) |
| `/admin/moderation` | Admin | Suspend profiles; read-only conversation thread viewer |

---

## Backend API routes (`tether-backend/app/api/`)

| Method | Path | Purpose |
|---|---|---|
| GET/PUT | `/api/profile` | Own profile (includes company_name) |
| GET | `/api/profile/views` | Creator view-count widgets (RPC) |
| GET | `/api/youtube/stats` | Fetch + snapshot YT stats; touches `last_active_at` |
| GET | `/api/creators/:username` | Public creator data (profiles + latest snapshots) |
| GET | `/api/business/discover` | Search creators with filters, sorting, pagination |
| GET/POST/DELETE | `/api/business/saved-creators` | Save/unsave creators |
| GET | `/api/business/saved-creators/batch` | Batch-enrich multiple creator profiles |
| GET/POST | `/api/conversations` | List threads / start new conversation |
| GET/POST | `/api/conversations/:id/messages` | Thread messages; marks read on GET |
| GET | `/api/creators/discover-businesses` | Creator browses business profiles |
| POST | `/api/track/view` | Record `page_views` + legacy `profile_views` on `/c/:username` visit |
| GET | `/api/admin/stats` | Platform totals: users, page views, messages |
| GET | `/api/admin/users` | All profiles with search/filter/pagination |
| PUT/DELETE | `/api/admin/users/:id` | Update role/suspended/admin; hard-delete user |
| GET | `/api/admin/platform-health` | Per-creator YT token + snapshot status |
| POST | `/api/admin/snapshot/trigger` | Manually invoke daily-snapshot edge function |
| GET | `/api/admin/analytics` | Aggregate page_views: viewer type, geo, device, referrer, daily |
| GET | `/api/admin/conversations` | All conversations with last message preview |
| GET | `/api/admin/conversations/:id` | Full message thread (read-only) |
| PUT | `/api/admin/profiles/:id/flag` | Set/unset `is_suspended` |

**Admin guard:** All `/api/admin/*` routes call `requireAdmin()` from `tether-backend/lib/adminGuard.ts` which verifies `profiles.is_admin = true` after JWT auth.

---

## Database

### Tables

| Table | Purpose |
|---|---|
| `profiles` | All users; creator + business + admin fields |
| `platform_tokens` | OAuth tokens (AES-256-GCM encrypted) |
| `metric_snapshots` | Time-series YouTube stats per creator |
| `saved_creators` | Business bookmarks of creator profiles |
| `conversations` | Creator ↔ business threads; UNIQUE(creator_id, business_id) |
| `messages` | Messages within conversations (body 1–2000 chars) |
| `profile_views` | Legacy view tracking (creator_id, viewer_id, viewed_at) — used by dashboard widgets |
| `page_views` | Rich view tracking for `/c/:username` — see tracking section below |

### Key profile columns

| Column | Type | Purpose |
|---|---|---|
| `user_type` | text | `'creator'` \| `'business'` |
| `company_name` | text | Business display name |
| `last_active_at` | timestamptz | Touched on dashboard load; cron skips creators inactive >30d |
| `is_admin` | boolean | Platform admin flag |
| `is_suspended` | boolean | Suspended users see `/suspended` page |

### Migrations (in order)

```
20260501162942_init_schema.sql
20260502000001_create_platform_tokens.sql
20260503000001_add_metric_visibility.sql
20260503000002_create_metric_snapshots.sql
20260503000003_schedule_daily_snapshot.sql
20260504000001_business_portal.sql
20260505000001_add_creator_category.sql
20260505000002_profile_views.sql
20260506000001_trgm_search_index.sql          -- pg_trgm GIN indexes for discover search
20260506000002_views_aggregate_rpc.sql        -- get_creator_view_stats() RPC
20260506000003_latest_snapshots_rpc.sql       -- get_latest_snapshots() RPC
20260506000004_platform_tokens_index.sql
20260506000005_latest_snapshots_batch_rpc.sql
20260506000006_company_name.sql
20260506000007_messaging.sql                  -- conversations + messages tables
20260507000001_last_active_at.sql
20260507000002_page_views.sql                 -- rich page view tracking table
20260507000003_admin.sql                      -- is_admin, is_suspended on profiles
```

---

## Page-view tracking (`page_views` table)

Every visit to `/c/:username` fires `POST /api/track/view` from the browser via the invisible `TrackView` client island (`tether-frontend/app/c/[username]/_components/TrackView.tsx`).

**Captured per view:**

| Field | Source |
|---|---|
| `viewer_type` | `'creator'` \| `'business'` \| `'anonymous'` |
| `country`, `region`, `city`, `timezone` | ip-api.com (free, no key, 2.5s timeout) |
| `device_type` | UA parse: `'mobile'` \| `'tablet'` \| `'desktop'` |
| `browser` | UA parse: Chrome / Firefox / Safari / Edge / Opera |
| `os` | UA parse: Windows / macOS / Android / iOS / ChromeOS / Linux |
| `language` | `Accept-Language` header |
| `referrer_type` | classified: `'direct'` \| `'search'` \| `'social'` \| `'internal'` \| `'other'` |
| `referrer_url` | full URL (≤500 chars) |
| `user_agent` | raw UA (≤300 chars) |

Self-views excluded (`user.id === profile.id` → treated as anonymous, no viewer_id written).

Composite indexes: `(profile_id, viewer_type, viewed_at)`, `(profile_id, country, viewed_at)`, `(profile_id, device_type, viewed_at)`, `(profile_id, referrer_type, viewed_at)`.

Legacy `profile_views` also gets a row on each visit (backward compat for dashboard widgets).

---

## Cron / edge functions

- **`daily-snapshot`** edge function: invoked by pg_cron at 00:05 UTC daily
- Filters to creators with `last_active_at >= now() - 30 days` (skips dormant accounts)
- Decrypts tokens, auto-refreshes if expiring within 10 min, fetches YouTube channel + videos, inserts `metric_snapshots`
- Manual trigger available via `POST /api/admin/snapshot/trigger` (admin only)

---

## Key files

| File | Role |
|---|---|
| `tether-frontend/middleware.ts` | Route guards for all roles including admin + suspension |
| `tether-frontend/lib/api.ts` | Typed client for all backend calls including `api.admin.*` |
| `tether-frontend/components/layout/Sidebar.tsx` | Creator/business nav with unread badge |
| `tether-frontend/components/layout/AdminSidebar.tsx` | Dark admin nav |
| `tether-backend/lib/adminGuard.ts` | `requireAdmin()` used by all admin routes |
| `tether-backend/lib/encryption.ts` | AES-256-GCM for platform token storage |
| `tether-backend/supabase/functions/daily-snapshot/index.ts` | Edge function for YouTube cron |

---

## Promoting an admin (one-time)

```sql
UPDATE profiles SET is_admin = TRUE WHERE username = 'your-username';
```
Then in Supabase Dashboard → Auth → Users → edit user → add to `user_metadata`:
```json
{ "is_admin": true }
```
Re-login required for the JWT to pick up the new metadata.

---

## Environment variables

**Backend (`tether-backend`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_SECRET` — AES-256-GCM key for platform token encryption
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `CRON_SECRET` — Bearer token checked by the daily-snapshot edge function

**Frontend (`tether-frontend`):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_URL`
