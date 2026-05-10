# Statvora — Project Context

Creator intelligence platform. Creators connect social accounts, get a unified analytics dashboard, and share a verified metrics link with brands/agencies — no screenshots, no manual reports.

---

## Repo layout

```
Tether2.0/
  tether-backend/    # Next.js 15 API-only app — all DB writes, YouTube/Instagram, edge functions
  tether-frontend/   # Next.js 15 fullstack app — single domain, all roles + admin panel
  .github/workflows/deploy.yml  # CI/CD — auto-deploys both apps on push to main
```

### Production URLs

| App | URL |
|---|---|
| Frontend | https://statvora.in |
| Backend API | https://api.statvora.in |
| Supabase | https://vywuvfjjqvanimizbero.supabase.co |
| Admin panel | https://statvora.in/admin |
| API docs | https://statvora.in/docs |
| Pricing | https://statvora.in/pricing |

### Vercel project IDs

| Project | Vercel name | ID |
|---|---|---|
| tether-frontend | `statvora-frontend` | `prj_7bF4HTZL1AATeT9CXOpAcXdpDX9I` |
| tether-backend | `statvora-backend` | `prj_DwCyPlnCTFDbE3vGTnowRTboTynv` |
| Vercel Org | — | `team_w61EPm8QPeCRNJAt1TAYUX2a` |

### CI/CD

GitHub Actions (`.github/workflows/deploy.yml`) deploys both apps to Vercel production on every push to `main` in two parallel jobs. Secrets set in repo: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID_FRONTEND`, `VERCEL_PROJECT_ID_BACKEND`.

Manual redeploy:
```bash
cd tether-frontend && npx vercel --prod
cd tether-backend  && npx vercel --prod
```

---

## Role system

Three roles stored in `profiles.user_type` and mirrored in Supabase JWT `user_metadata`:

| Role | `user_type` | `is_admin` | Home page |
|---|---|---|---|
| Content creator | `'creator'` | false | `/dashboard` |
| Marketing / agency | `'business'` | false | `/discover` |
| Platform operator | either | **true** | `/admin/users` |

Role embedded in JWT at signup:
```typescript
supabase.auth.signUp({ options: { data: { user_type: "creator" | "business", full_name, username } } })
```

`is_admin` must be set manually — see "Admin accounts" section.

**Middleware route guards** (`tether-frontend/middleware.ts`):
- `/dashboard`, `/onboarding`, `/businesses` → creator only; businesses → `/discover`
- `/discover`, `/saved` → business only; creators → `/dashboard`
- `/admin/*` → `is_admin: true` in JWT only
- `/messages` → both roles
- `/suspended` → users with `is_suspended: true`; sign-out only
- `/pricing`, `/docs`, `/c/*` → public (no auth required)

---

## Feature inventory

### Creator features
| Feature | Where |
|---|---|
| Email signup / Google OAuth | `/signup`, `/login` |
| Login with email **or username** | `/login` → resolves via `POST /api/auth/resolve-email` |
| Multi-step onboarding wizard | `/onboarding` |
| Connect YouTube (OAuth, auto-refresh) | Dashboard → Connect YouTube |
| Connect Instagram (OAuth, long-lived token) | Dashboard → Connect Instagram |
| YouTube analytics dashboard | `/dashboard` |
| Metric visibility toggles | `/dashboard` |
| Profile view stats widget (weekly / daily chart) | `/dashboard` |
| Shareable public profile link `/c/:username` | `/dashboard` |
| Edit profile (name, username, bio, avatar, category, stage) | `/settings` |
| Browse & search business profiles | `/businesses` |
| Real-time messaging with businesses | `/messages` |
| Daily automated YouTube snapshot | Background cron 00:05 UTC |

### Business features
| Feature | Where |
|---|---|
| Email signup / Google OAuth | `/signup`, `/login` |
| Login with email **or username** | `/login` |
| Discover creators — search, filter, sort | `/discover` |
| Save / unsave creators | `/discover`, `/saved` |
| Saved creator list with enriched metrics | `/saved` |
| View creator public profiles | `/c/:username` |
| Real-time messaging with creators | `/messages` |
| Edit business profile | `/settings` |
| Subscription management (upgrade / billing portal) | `/settings` → Subscription tab |
| Generate & revoke API keys (max 10) | `/settings` → Developer tab |
| Interactive API documentation (Swagger) | `/docs` |

### Developer features (business + API key)
| Feature | Endpoint |
|---|---|
| Search creators with metrics | `GET /api/v1/creators` |
| Get own business profile | `GET /api/v1/me` |
| Update own business profile | `PATCH /api/v1/me` |
| List own saved creators | `GET /api/v1/saved` |
| Save a creator | `POST /api/v1/saved` |
| Unsave a creator | `DELETE /api/v1/saved` |

All writes scoped to API key owner — structurally impossible to modify another org's data.

### Admin features (`is_admin = true`)
| Feature | Where |
|---|---|
| User table — search, filter, suspend, change role, delete | `/admin/users` |
| Platform health — YouTube token status, snapshot staleness | `/admin/health` |
| Manually trigger daily snapshot | `/admin/health` |
| Platform analytics — views, geo, device, referrer, daily chart | `/admin/analytics` |
| Moderate profiles & read-only conversation viewer | `/admin/moderation` |
| Subscription plan management — prices, Stripe IDs, feature toggles, rate limits | `/admin/subscriptions` |
| Platform settings — sales email, stripe_enabled flag | `/admin/settings` |

### Public features
| Feature | Where |
|---|---|
| Creator public profile (ISR, 5 min revalidate) | `/c/:username` |
| API documentation (Swagger UI, loaded from backend) | `/docs` |
| Pricing page (plan comparison, Stripe checkout) | `/pricing` |

---

## Frontend pages (`tether-frontend/app/`)

| Route | Who | Purpose |
|---|---|---|
| `/login` | Public | Email or username + password; Google OAuth; Creator/Business toggle |
| `/signup` | Public | Role picker → First/Last name + email/password form |
| `/onboarding` | Creator | Multi-step profile setup wizard (username pre-filled from signup) |
| `/dashboard` | Creator | YouTube analytics, visibility toggles, public profile link |
| `/businesses` | Creator | Browse & message business profiles |
| `/messages` | Both | Split-panel Realtime chat |
| `/discover` | Business | Search/filter/save creators |
| `/saved` | Business | Saved creator list with live metrics |
| `/settings` | Both | Profile, Account, Subscription (business), Developer (business), Notifications |
| `/pricing` | Public | Creator/business plan cards, monthly/annual toggle, Stripe checkout, Enterprise mailto |
| `/c/[username]` | Public | Creator public profile (ISR Server Component) |
| `/suspended` | Auth | Suspended users — sign out only |
| `/docs` | Public | Swagger UI pointing at `NEXT_PUBLIC_BACKEND_URL/api/docs` |
| `/admin/users` | Admin | Paginated user table |
| `/admin/health` | Admin | YouTube token health + manual snapshot trigger |
| `/admin/analytics` | Admin | Page-view analytics (7/30/90d) |
| `/admin/moderation` | Admin | Suspend profiles; read-only conversation viewer |
| `/admin/subscriptions` | Admin | Feature matrix, rate limits, Stripe price IDs per plan |
| `/admin/settings` | Admin | Sales email, stripe_enabled toggle, env var reference |

**Styling:** Tailwind CSS 3.4, `brand-600 = #7c3aed`. Shared classes in `globals.css`: `.card`, `.btn-primary`, `.input`, `.sidebar-link`. Inter font via `next/font`. No external UI library.

---

## Backend API routes (`tether-backend/app/api/`)

### Auth & identity
| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/google/code` | Google OAuth2 code exchange → `signInWithIdToken` → redirect to `/auth/google/complete` |
| POST | `/api/auth/logout` | Sign out, clear cookies |
| GET | `/api/me` | Current user id + email |
| POST | `/api/auth/resolve-email` | Username → email lookup (no auth); used by login page |

### Profile
| Method | Path | Notes |
|---|---|---|
| GET/PUT | `/api/profile` | Own profile — all editable fields |
| GET | `/api/profile/check-username` | `?username=x` → `{ available }` |
| GET | `/api/profile/views` | View-count widgets via `get_creator_view_stats()` RPC |

### YouTube & Instagram
| Method | Path | Notes |
|---|---|---|
| POST | `/api/oauth/youtube` | Returns Google consent URL |
| GET | `/api/oauth/youtube/callback` | Code exchange → encrypted token store |
| GET | `/api/youtube/stats` | Channel stats + recent videos; writes `metric_snapshots`; touches `last_active_at` |
| POST | `/api/oauth/instagram` | Returns Facebook consent URL |
| GET | `/api/oauth/instagram/callback` | Code exchange → long-lived token store |

### Creators & discovery
| Method | Path | Notes |
|---|---|---|
| GET | `/api/creators/:username` | Public profile + platforms + latest snapshots |
| GET | `/api/business/discover` | Search creators (filters, sorting, pagination) |
| GET/POST/DELETE | `/api/business/saved-creators` | Save/unsave |
| GET | `/api/business/saved-creators/batch` | Batch-enrich multiple saved creators (1 DB query) |
| GET | `/api/creators/discover-businesses` | Creator browses business profiles |

### Messaging
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/conversations` | List / start threads |
| GET/POST | `/api/conversations/:id/messages` | Thread messages; GET marks incoming read |

### Tracking
| Method | Path | Notes |
|---|---|---|
| POST | `/api/track/view` | Page view record on `/c/:username` visit |

### Subscriptions & Stripe
| Method | Path | Notes |
|---|---|---|
| GET | `/api/subscriptions/plans` | All active plans + features (public, s-maxage=60) |
| GET | `/api/subscriptions/current` | Authenticated user's subscription + effective plan |
| POST | `/api/stripe/checkout` | Create Checkout session `{ plan_id }` → `{ url }` |
| POST | `/api/stripe/portal` | Create Customer Portal session → `{ url }` |
| POST | `/api/stripe/webhook` | Stripe webhook (signature-verified); syncs `user_subscriptions` |

### Developer API keys (session auth, business only)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/developer/keys` | List own keys (no raw key exposed) |
| POST | `/api/developer/keys` | Create key `{ name, expires_at? }` → raw key returned **once** |
| DELETE | `/api/developer/keys/:id` | Revoke (sets `is_active = false`) |

### v1 Public API (API-key auth: `Authorization: Bearer tth_<key>`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/v1/creators` | Search creators with metrics |
| GET | `/api/v1/me` | Own business profile |
| PATCH | `/api/v1/me` | Update `company_name`, `bio`, `website` only |
| GET | `/api/v1/saved` | Own saved creator list |
| POST | `/api/v1/saved` | Save creator `{ creator_username }` |
| DELETE | `/api/v1/saved` | Unsave creator `{ creator_username }` |
| GET | `/api/docs` | OpenAPI spec JSON (CORS open; consumed by `/docs` Swagger UI) |

### Admin routes (all require `is_admin = true`)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/stats` | Platform totals |
| GET | `/api/admin/users` | All profiles, paginated, filterable |
| PUT | `/api/admin/users/:id` | Update `user_type`, `is_suspended`, `is_admin` |
| DELETE | `/api/admin/users/:id` | Hard-delete via `supabase.auth.admin.deleteUser` |
| GET | `/api/admin/platform-health` | Per-creator YouTube token status |
| POST | `/api/admin/snapshot/trigger` | Manually invoke daily-snapshot edge function |
| GET | `/api/admin/analytics` | Aggregate page_views (7/30/90d) |
| GET | `/api/admin/conversations` | All conversations, paginated |
| GET | `/api/admin/conversations/:id` | Full thread (read-only) |
| PUT | `/api/admin/profiles/:id/flag` | Set/unset `is_suspended` |
| GET/PATCH | `/api/admin/subscriptions/plans` | List plans; update price/stripe_price_id/is_active |
| GET/PUT | `/api/admin/subscriptions/features` | List feature defs; upsert plan→feature config |
| GET/PUT | `/api/admin/settings` | Read/write `platform_settings` |

---

## Database schema

### Tables

| Table | Purpose |
|---|---|
| `profiles` | All users; `user_type`, `is_admin`, `is_suspended`, `metric_visibility` JSONB |
| `platform_tokens` | AES-256-GCM encrypted OAuth tokens per user/platform |
| `metric_snapshots` | Time-series YouTube stats per creator |
| `saved_creators` | Business bookmarks; UNIQUE(business_user_id, creator_username) |
| `conversations` | Creator ↔ business threads; UNIQUE(creator_id, business_id) |
| `messages` | Messages per conversation (body 1–2000 chars); Realtime enabled |
| `profile_views` | Legacy view tracking; used by dashboard view-count widgets |
| `page_views` | Rich analytics per `/c/:username` visit (geo, device, referrer, viewer type) |
| `api_keys` | Developer API keys (SHA-256 hash, prefix, active flag, expiry) |
| `platform_settings` | Admin key-value config (sales_email, stripe_enabled) |
| `subscription_plans` | 16 seeded plans (4 tiers × 2 user types × monthly/annual) |
| `feature_definitions` | 24 platform features with user_type, category, sort_order |
| `plan_features` | Per-plan: is_enabled, rate_limit, rate_period — admin-editable |
| `user_subscriptions` | One row per user; synced by Stripe webhooks |
| `feature_usage` | Usage counters per user/feature/period for rate limiting |

### Key `profiles` columns

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | matches `auth.users.id` |
| `username` | text UNIQUE | auto-generated at signup (`firstName + 6 random chars`); user can change in Settings |
| `full_name` | text | collected at signup (First + Last name); display name for creators |
| `company_name` | text | business display name |
| `user_type` | text | `'creator'` \| `'business'` |
| `metric_visibility` | JSONB | `{ subscribers, total_views, video_count, avg_views, view_chart, recent_videos }` |
| `last_active_at` | timestamptz | touched on every `/api/youtube/stats` call; cron skips inactive >30d creators |
| `is_admin` | boolean | checked by middleware via JWT `user_metadata.is_admin` |
| `is_suspended` | boolean | suspended users see `/suspended` |

### Migrations (all applied to production)

| File | What it does |
|---|---|
| `20260501162942_init_schema.sql` | `profiles`, RLS, `updated_at` trigger |
| `20260502000001_create_platform_tokens.sql` | `platform_tokens`, RLS |
| `20260503000001_add_metric_visibility.sql` | `metric_visibility` JSONB on profiles |
| `20260503000002_create_metric_snapshots.sql` | `metric_snapshots`, indexes, RLS |
| `20260503000003_schedule_daily_snapshot.sql` | pg_cron + pg_net at 00:05 UTC |
| `20260504000001_business_portal.sql` | `user_type`, `saved_creators`, RLS |
| `20260505000001_add_creator_category.sql` | `category` on profiles |
| `20260505000002_profile_views.sql` | `profile_views`, RLS |
| `20260506000001_trgm_search_index.sql` | pg_trgm GIN indexes on username + full_name |
| `20260506000002_views_aggregate_rpc.sql` | `get_creator_view_stats()` RPC |
| `20260506000003_latest_snapshots_rpc.sql` | `get_latest_snapshots()` RPC |
| `20260506000004_platform_tokens_index.sql` | Index on `platform_tokens(user_id)` |
| `20260506000005_latest_snapshots_batch_rpc.sql` | Batch snapshots RPC |
| `20260506000006_company_name.sql` | `company_name` on profiles |
| `20260506000007_messaging.sql` | `conversations` + `messages`, RLS, Realtime |
| `20260507000001_last_active_at.sql` | `last_active_at` on profiles |
| `20260507000002_page_views.sql` | `page_views`, composite indexes, RLS |
| `20260507000003_admin.sql` | `is_admin` + `is_suspended` on profiles |
| `20260507000004_api_keys.sql` | `api_keys`, RLS |
| `20260508000001_subscriptions.sql` | All subscription tables, feature defs, seeded plans, RLS, RPC |

Apply new migrations: `cd tether-backend && npx supabase db push` (project linked to `vywuvfjjqvanimizbero`).

---

## Subscription system

### Plans (seeded defaults, all admin-editable)

| Tier | Creator monthly | Creator annual | Business monthly | Business annual |
|---|---|---|---|---|
| Starter | Free | Free | Free | Free |
| Specialist | $9/mo | $90/yr | $49/mo | $490/yr |
| Growth | $19/mo | $190/yr | $99/mo | $990/yr |
| Enterprise | Contact sales | Contact sales | Contact sales | Contact sales |

Enterprise shows a `mailto:` button using `platform_settings.sales_email`.

### Feature gating (`lib/featureGuard.ts`)

`checkFeatureAccess(userId, featureKey, increment = true)`:
1. Reads `user_subscriptions.plan_id` — falls back to Starter if no row exists
2. Checks `plan_features.is_enabled`
3. If `rate_limit` set: reads `feature_usage`, rejects with 429 if over limit
4. Atomically increments usage via `increment_feature_usage(p_user_id, p_feature_key, p_period_start)` RPC
5. Returns `{ allowed: true, remaining }` or `{ allowed: false, reason, status: 403 | 429 }`

**Note:** `featureGuard` is built and tested but not yet wired into existing API routes. Apply it to routes as subscription enforcement is needed.

### Stripe (not yet live)

Required env vars on `tether-backend` Vercel project:
- `STRIPE_SECRET_KEY` = `sk_live_...` or `sk_test_...`
- `STRIPE_WEBHOOK_SECRET` = `whsec_...` (create webhook pointing to `/api/stripe/webhook`)

Admin steps once keys are set:
1. `/admin/settings` → set `stripe_enabled = true`
2. `/admin/subscriptions` → paste Stripe Price IDs for each paid plan
3. Webhook events to handle: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

---

## Auth flows

### Signup — email
1. User picks role (creator/business) then enters **First name**, Last name, email, password.
2. `supabase.auth.signUp()` called with `options.data = { user_type, full_name, username }`.
3. `username` is auto-generated as `firstName + 6 random alphanumeric chars` (e.g. `jane4x9m2k`).
4. If session is live immediately: `PUT /api/profile` called to persist profile row right away.
5. Creator → `/onboarding` (username field pre-filled); Business → `/discover`.

### Login — email or username
1. User types email or username into the identifier field.
2. If no `@`: frontend calls `POST /api/auth/resolve-email` with `{ identifier }`.
3. Backend looks up `profiles.username` → fetches email via `auth.admin.getUserById()` → returns `{ email }`.
4. Frontend calls `supabase.auth.signInWithPassword({ email, password })`.

### Google OAuth (custom flow)
1. Signup/login page builds Google OAuth URL manually (scope: `openid email profile`).
2. Redirect URI: `<origin>/api/auth/google/code` (frontend Next.js API route).
3. Google redirects back with `?code=`.
4. `/api/auth/google/code` exchanges code with Google token endpoint (server-side, uses `GOOGLE_CLIENT_SECRET`).
5. Calls `supabase.auth.signInWithIdToken({ provider: "google", token: id_token })`.
6. Redirects to `/auth/google/complete`.
7. `/auth/google/complete` (client component):
   - Reads `_pending_user_type` from localStorage (set before redirect).
   - Extracts `full_name` from `user.user_metadata.full_name` (Supabase populates from Google ID token).
   - Generates `username = givenName + 6 random chars`.
   - Calls `supabase.auth.updateUser({ data: { user_type, full_name } })`.
   - Calls `PUT /api/profile` to persist the profile row.
   - Clears `_pending_user_type`, `_pending_full_name`, `_pending_company` from localStorage.
   - Redirects to `/onboarding` (new creator) or `/discover` (business).

**localStorage keys used during OAuth:**
- `_pending_user_type` — `"creator"` | `"business"`
- `_pending_full_name` — name typed before Google redirect (if any)
- `_pending_company` — company name for business signups

### Session rules
- Always `supabase.auth.getUser()` server-side — never `getSession()` alone
- Always use `127.0.0.1` locally — `localhost` breaks cookie domain matching with Supabase

---

## CORS

Handled by `tether-backend/middleware.ts` (not `vercel.json`). It reads `FRONTEND_URL` env var and sets `Access-Control-Allow-Origin` to match. Both the local dev origin (`http://127.0.0.1:3001`) and the production origin (`https://statvora.in`) are allowed simultaneously.

---

## Key libs (`tether-backend/lib/`)

| File | Purpose |
|---|---|
| `adminGuard.ts` | `requireAdmin()` — JWT verify + `profiles.is_admin = true` check |
| `apiKeyGuard.ts` | `requireApiKey()` — SHA-256 hash lookup; updates `last_used_at` fire-and-forget |
| `featureGuard.ts` | `checkFeatureAccess()` — plan lookup, feature toggle, rate limit, usage increment |
| `stripe.ts` | Null-safe Stripe client — returns `null` if `STRIPE_SECRET_KEY` not set |
| `encryption.ts` | AES-256-GCM encrypt/decrypt; format: `iv_hex:authTag_hex:ciphertext_hex` |
| `supabase.ts` | Service-role admin client (bypasses RLS) |
| `supabaseServer.ts` | `getUserFromBearer()` — JWT verification for session-auth routes |
| `config.ts` | All URLs and platform constants |
| `youtube.ts` | YouTube Data API calls; capped at 100 videos, parallel chunk fetches |

---

## API key format

`tth_` + 32 random bytes hex = 68 chars total. Only SHA-256 hash stored. Raw key shown once at creation. Max 10 active keys per business user.

---

## Token encryption

```
key  = SHA-256(ENCRYPTION_SECRET)  →  32 bytes
algo = AES-256-GCM
iv   = 16 random bytes per call
stored as: iv_hex:authTag_hex:ciphertext_hex
```

OAuth state signed with HMAC-SHA256 (`userId:ts`) and expires after 10 min.

---

## Page-view tracking

Every `/c/:username` visit fires `POST /api/track/view` from the invisible `TrackView` client island.

Captured: `viewer_type`, country/region/city (ip-api.com), `device_type`, browser, OS, language, `referrer_type`, `referrer_url`. Self-views excluded. Legacy `profile_views` row also written for dashboard widgets.

Analytics indexed on `(profile_id, viewer_type, viewed_at)`, `(profile_id, country, viewed_at)`, `(profile_id, device_type, viewed_at)`, `(profile_id, referrer_type, viewed_at)`.

---

## Cron / edge functions

**`daily-snapshot`** (`supabase/functions/daily-snapshot/index.ts`):
- pg_cron triggers at 00:05 UTC via pg_net HTTP POST
- Only runs for creators with `last_active_at >= now() - 30 days`
- Per creator: decrypt token → refresh if expiring <10 min → fetch stats + 5 videos → insert `metric_snapshots`
- Manual trigger: `POST /api/admin/snapshot/trigger` (admin only)

```bash
# Test locally
supabase functions serve daily-snapshot --env-file supabase/.env.local --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/daily-snapshot \
  -H "Authorization: Bearer tether_cron_secret_local"
```

---

## Local dev setup

Both apps connect to the **production Supabase instance** locally. No local Supabase required.

```bash
# Terminal 1 — backend (port 3000)
cd tether-backend && npm run dev

# Terminal 2 — frontend (port 3001)
cd tether-frontend && npm run dev
```

**`tether-backend/.env.local`:**
```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
FRONTEND_URL=http://127.0.0.1:3001
NEXT_PUBLIC_SUPABASE_URL=https://vywuvfjjqvanimizbero.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
SUPABASE_SERVICE_ROLE_KEY=<production service role key>
ENCRYPTION_SECRET=<must match production value>
GOOGLE_CLIENT_ID=<Google Cloud OAuth client>
GOOGLE_CLIENT_SECRET=<Google Cloud OAuth secret>
YOUTUBE_REDIRECT_URI=http://127.0.0.1:3000/api/oauth/youtube/callback
CRON_SECRET=tether_cron_secret_local
STRIPE_SECRET_KEY=sk_test_...   (optional)
STRIPE_WEBHOOK_SECRET=whsec_... (optional)
```

**`tether-frontend/.env.local`:**
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<Google Cloud OAuth client>
GOOGLE_CLIENT_SECRET=<Google Cloud OAuth secret>
NEXT_PUBLIC_SUPABASE_URL=https://vywuvfjjqvanimizbero.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production anon key>
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
```

Get production Supabase keys:
```bash
cd tether-backend && supabase projects api-keys --project-ref vywuvfjjqvanimizbero
```

**Google Cloud redirect URIs to register:**
```
http://127.0.0.1:3001/api/auth/google/code  ← local login/signup
http://127.0.0.1:3000/api/oauth/youtube/callback ← local YouTube connect
https://statvora.in/api/auth/google/code         ← production login/signup
https://api.statvora.in/api/oauth/youtube/callback ← production YouTube connect
```

> Always use `127.0.0.1`, not `localhost` — cookie domain matching requires it.

---

## Admin accounts

**Primary admin:** email `sutharhimanshu98@gmail.com`, username `iamhspace`, `is_admin: true`.

**Promoting a new admin:**
```sql
UPDATE profiles SET is_admin = TRUE WHERE username = 'target-username';
```
Then Supabase Dashboard → Auth → Users → edit user → add `{ "is_admin": true }` to `user_metadata`. User must re-login for JWT to update.

**Creating an admin via API** (profile trigger doesn't fire for admin-created users — insert manually):
```bash
# 1. Create auth user
curl -X POST "https://vywuvfjjqvanimizbero.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"...","email_confirm":true,"user_metadata":{"user_type":"business","is_admin":true}}'

# 2. Insert profile row manually
curl -X POST "https://vywuvfjjqvanimizbero.supabase.co/rest/v1/profiles" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"id":"<user_id>","username":"...","user_type":"business","is_admin":true}'
```
