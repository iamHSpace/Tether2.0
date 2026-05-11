# Statvora — Database Reference

Supabase Postgres. Project ref: `vywuvfjjqvanimizbero`. All tables in the `public` schema. Row-Level Security (RLS) enabled on all tables.

---

## Tables

### `profiles`

One row per user. Created automatically by a Postgres trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | Matches `auth.users.id` |
| `username` | `text` UNIQUE | Auto-generated at signup (`firstName + 6 random alphanumeric`). User can change in Settings. |
| `full_name` | `text` | First + Last name collected at signup. Display name for creators. |
| `company_name` | `text` | Business display name. |
| `user_type` | `text` | `'creator'` or `'business'` |
| `bio` | `text` | Short bio / description |
| `website` | `text` | External URL |
| `avatar_url` | `text` | Profile photo URL |
| `category` | `text` | Creator content category (e.g. "Tech", "Gaming", "Fitness") |
| `career_stage` | `text` | Creator career stage label |
| `location` | `text` | |
| `metric_visibility` | `jsonb` | `{ subscribers, total_views, video_count, avg_views, view_chart, recent_videos }` — all booleans |
| `last_active_at` | `timestamptz` | Updated on every `/api/youtube/stats` call. Daily snapshot cron skips creators inactive > 30 days. |
| `is_admin` | `boolean` | Default `false`. Set manually via SQL + user_metadata update. |
| `is_suspended` | `boolean` | Default `false`. Suspended users see `/suspended` page only. |
| `created_at` | `timestamptz` | Auto |
| `updated_at` | `timestamptz` | Auto-updated by trigger on any row change |

**RLS:** Users can read their own row + any row (public profiles). Only the owner can update their row.

---

### `platform_tokens`

AES-256-GCM encrypted OAuth tokens per user per platform.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles.id` | Indexed |
| `platform` | `text` | `'youtube'` or `'instagram'` |
| `encrypted_token` | `text` | AES-256-GCM encrypted. Format: `iv_hex:authTag_hex:ciphertext_hex` |
| `token_expires_at` | `timestamptz` | Token expiry; checked before API calls |
| `token_metadata` | `jsonb` | Platform-specific metadata (e.g. `{ ig_user_id }` for Instagram) |
| `connected_at` | `timestamptz` | When the user first connected this platform |
| `created_at` | `timestamptz` | Auto |

**Unique constraint:** `(user_id, platform)` — one token per platform per user.

**RLS:** Only the owner can read or modify their own tokens (via `auth.uid() = user_id`). Backend uses service role to bypass RLS for encryption operations.

---

### `metric_snapshots`

Time-series analytics data. One row per creator per platform per snapshot event.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles.id` | |
| `platform` | `text` | `'youtube'` or `'instagram'` |
| `data` | `jsonb` | Platform-specific shape (see below) |
| `captured_at` | `timestamptz` | Default `now()` |

**YouTube data shape:**
```json
{
  "channel": {
    "id": "UCxxx",
    "title": "Channel Name",
    "subscribers": 12400,
    "totalViews": 1840000,
    "videoCount": 87,
    "publishedAt": "2020-03-15T00:00:00Z",
    "country": "IN"
  },
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "Video Title",
      "publishedAt": "2024-11-01T10:00:00Z",
      "views": 45200,
      "likes": 1800,
      "comments": 220,
      "thumbnail": "https://..."
    }
  ]
}
```

**Instagram data shape:**
```json
{
  "account": {
    "id": "17841400000000000",
    "username": "creator_handle",
    "name": "Creator Name",
    "followers_count": 8200,
    "media_count": 134,
    "profile_picture_url": "https://..."
  },
  "posts": [
    {
      "id": "17854360000000000",
      "media_type": "IMAGE",
      "media_url": "https://...",
      "thumbnail_url": null,
      "caption": "Post caption...",
      "timestamp": "2024-11-10T14:30:00Z",
      "like_count": 320,
      "comments_count": 18
    }
  ]
}
```

**RLS:** Creators can read their own snapshots. Public read allowed (used by `/c/:username`).

---

### `saved_creators`

Business user bookmarks.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `business_user_id` | `uuid` FK → `profiles.id` | |
| `creator_username` | `text` | |
| `saved_at` | `timestamptz` | Default `now()` |

**Unique constraint:** `(business_user_id, creator_username)`

**RLS:** Business users can only read/write their own saved creators.

---

### `conversations`

Creator ↔ business messaging threads.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `creator_id` | `uuid` FK → `profiles.id` | |
| `business_id` | `uuid` FK → `profiles.id` | |
| `created_at` | `timestamptz` | |
| `last_message_at` | `timestamptz` | Updated on new message |

**Unique constraint:** `(creator_id, business_id)` — one thread per pair.

**RLS:** Only participants can read/write their own conversations.

---

### `messages`

Messages within a conversation. Supabase Realtime enabled.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `conversation_id` | `uuid` FK → `conversations.id` | |
| `sender_id` | `uuid` FK → `profiles.id` | |
| `body` | `text` | 1–2000 characters (check constraint) |
| `is_read` | `boolean` | Default `false`; marked true when other participant fetches messages |
| `created_at` | `timestamptz` | |

**RLS:** Only conversation participants can read/insert messages.

---

### `profile_views` (legacy)

Used only for the creator dashboard view-count widgets. Superseded by `page_views` for analytics.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK → `profiles.id` | |
| `viewer_id` | `uuid` nullable | Logged-in viewer's user ID |
| `viewed_at` | `timestamptz` | Default `now()` |

---

### `page_views`

Rich analytics record written on every `/c/:username` visit.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `profile_id` | `uuid` FK → `profiles.id` | Profile being viewed |
| `viewer_type` | `text` | `'business'`, `'creator'`, `'public'` |
| `country` | `text` | 2-letter ISO code via ip-api.com |
| `region` | `text` | |
| `city` | `text` | |
| `device_type` | `text` | `'desktop'`, `'mobile'`, `'tablet'` |
| `browser` | `text` | |
| `os` | `text` | |
| `language` | `text` | Accept-Language header |
| `referrer_type` | `text` | `'direct'`, `'social'`, `'search'`, `'other'` |
| `referrer_url` | `text` | |
| `viewed_at` | `timestamptz` | Default `now()` |

**Indexes:** `(profile_id, viewer_type, viewed_at)`, `(profile_id, country, viewed_at)`, `(profile_id, device_type, viewed_at)`, `(profile_id, referrer_type, viewed_at)`.

**Note:** Self-views are excluded in the tracking route.

---

### `api_keys`

Developer API keys for business users.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles.id` | |
| `name` | `text` | Human-readable label |
| `key_hash` | `text` UNIQUE | SHA-256 hash of the raw key |
| `key_prefix` | `text` | First 8 chars of the raw key for UI display |
| `is_active` | `boolean` | Revoke by setting `false` |
| `expires_at` | `timestamptz` nullable | Optional expiry |
| `last_used_at` | `timestamptz` | Updated fire-and-forget on each use |
| `created_at` | `timestamptz` | |

**Limit:** Max 10 active keys per user (enforced in API route).

---

### `platform_settings`

Admin key-value configuration store.

| Column | Type | Notes |
|---|---|---|
| `key` | `text` PK | |
| `value` | `text` | |
| `updated_at` | `timestamptz` | |

**Current keys:**
- `sales_email` — email shown on Enterprise plan cards
- `stripe_enabled` — `'true'` | `'false'`; gates all Stripe routes

---

### `subscription_plans`

16 seeded plans (4 tiers × 2 user types × 2 billing periods). Admin-editable.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | e.g. `'Growth'` |
| `user_type` | `text` | `'creator'` or `'business'` |
| `billing_period` | `text` | `'monthly'` or `'annual'` |
| `price_usd` | `numeric(10,2)` | `0` for free/enterprise |
| `stripe_price_id` | `text` nullable | Set by admin once Stripe is live |
| `is_active` | `boolean` | Inactive plans hidden from pricing page |
| `tier_order` | `integer` | Sort order (1=Starter, 4=Enterprise) |
| `description` | `text` | Short plan description |
| `created_at` | `timestamptz` | |

---

### `feature_definitions`

24 platform features. Defines what can be gated.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `key` | `text` UNIQUE | Programmatic identifier (e.g. `'api_access'`, `'save_creators'`) |
| `name` | `text` | Human-readable label |
| `description` | `text` | |
| `user_type` | `text` | `'creator'`, `'business'`, or `'both'` |
| `category` | `text` | `'core'`, `'analytics'`, `'messaging'`, `'api'` |
| `sort_order` | `integer` | Display order in admin UI |

---

### `plan_features`

Per-plan feature configuration. Admin-editable at `/admin/subscriptions`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `plan_id` | `uuid` FK → `subscription_plans.id` | |
| `feature_id` | `uuid` FK → `feature_definitions.id` | |
| `is_enabled` | `boolean` | Feature on/off for this plan |
| `rate_limit` | `integer` nullable | Max uses per period (null = unlimited) |
| `rate_period` | `text` nullable | `'day'`, `'week'`, `'month'` |

**Unique constraint:** `(plan_id, feature_id)`

---

### `user_subscriptions`

One row per user. Updated by Stripe webhooks.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` UNIQUE FK → `profiles.id` | |
| `plan_id` | `uuid` FK → `subscription_plans.id` | |
| `stripe_customer_id` | `text` nullable | |
| `stripe_subscription_id` | `text` nullable | |
| `status` | `text` | `'active'`, `'canceled'`, `'past_due'`, `'trialing'` |
| `current_period_start` | `timestamptz` | |
| `current_period_end` | `timestamptz` | |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

If no row exists for a user, they are implicitly on the Starter (free) plan.

---

### `feature_usage`

Usage counters for rate-limited features.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles.id` | |
| `feature_key` | `text` | Matches `feature_definitions.key` |
| `period_start` | `timestamptz` | Start of the current rate-limit window |
| `usage_count` | `integer` | Atomically incremented by RPC |
| `updated_at` | `timestamptz` | |

**Unique constraint:** `(user_id, feature_key, period_start)`

---

## Postgres Functions (RPCs)

### `get_creator_view_stats(p_user_id uuid)`

Returns view-count widgets for the creator dashboard. Called by `GET /api/profile/views`.

Returns:
- `this_week` — total views in the last 7 days
- `last_week` — total views in the 7 days before that
- `daily_counts` — array of `{ date, count }` for the last 7 days

Uses `COUNT(*) FILTER (WHERE ...)` to compute all aggregates in a single query.

---

### `get_latest_snapshots(p_user_id uuid)`

Returns the most recent snapshot per platform for a given user. Used by `GET /api/creators/:username`.

```sql
SELECT DISTINCT ON (platform)
  platform, data, captured_at
FROM metric_snapshots
WHERE user_id = p_user_id
ORDER BY platform, captured_at DESC
```

Avoids in-memory deduplication and fixes the correctness bug where `.limit(10)` could miss a second platform's latest snapshot.

---

### `get_latest_snapshots_batch(p_user_ids uuid[])`

Same as above but for multiple users. Used by `GET /api/business/saved-creators/batch`.

---

### `increment_feature_usage(p_user_id uuid, p_feature_key text, p_period_start timestamptz)`

Atomically upserts `feature_usage` and increments `usage_count`. Used by `lib/featureGuard.ts` to avoid race conditions on concurrent requests.

```sql
INSERT INTO feature_usage (user_id, feature_key, period_start, usage_count)
VALUES (p_user_id, p_feature_key, p_period_start, 1)
ON CONFLICT (user_id, feature_key, period_start)
DO UPDATE SET usage_count = feature_usage.usage_count + 1, updated_at = now()
RETURNING usage_count
```

---

## Indexes

| Table | Index | Type | Purpose |
|---|---|---|---|
| `profiles` | `username` | B-tree | Unique lookup by username |
| `profiles` | `profiles_username_trgm` | GIN (pg_trgm) | Fast `ilike` search in discover |
| `profiles` | `profiles_full_name_trgm` | GIN (pg_trgm) | Fast `ilike` search in discover |
| `platform_tokens` | `platform_tokens_user_id_idx` | B-tree | Fast lookup by user_id |
| `metric_snapshots` | `(user_id, platform, captured_at DESC)` | B-tree | Latest snapshot queries |
| `page_views` | 4 composite indexes | B-tree | Admin analytics queries |
| `api_keys` | `key_hash` | B-tree UNIQUE | O(1) API key lookup |

---

## Migrations

All migration files live in `tether-backend/supabase/migrations/`. Applied in timestamp order.

| Migration | What it adds |
|---|---|
| `20260501162942_init_schema.sql` | `profiles` table, RLS, `updated_at` trigger |
| `20260502000001_create_platform_tokens.sql` | `platform_tokens`, RLS |
| `20260503000001_add_metric_visibility.sql` | `metric_visibility` JSONB on profiles |
| `20260503000002_create_metric_snapshots.sql` | `metric_snapshots`, indexes, RLS |
| `20260503000003_schedule_daily_snapshot.sql` | pg_cron + pg_net job at 00:05 UTC |
| `20260504000001_business_portal.sql` | `user_type` column, `saved_creators` table, RLS |
| `20260505000001_add_creator_category.sql` | `category` column on profiles |
| `20260505000002_profile_views.sql` | `profile_views` table, RLS |
| `20260506000001_trgm_search_index.sql` | pg_trgm extension + GIN indexes |
| `20260506000002_views_aggregate_rpc.sql` | `get_creator_view_stats()` RPC |
| `20260506000003_latest_snapshots_rpc.sql` | `get_latest_snapshots()` RPC |
| `20260506000004_platform_tokens_index.sql` | Index on `platform_tokens(user_id)` |
| `20260506000005_latest_snapshots_batch_rpc.sql` | `get_latest_snapshots_batch()` RPC |
| `20260506000006_company_name.sql` | `company_name` column on profiles |
| `20260506000007_messaging.sql` | `conversations` + `messages`, RLS, Realtime |
| `20260507000001_last_active_at.sql` | `last_active_at` column on profiles |
| `20260507000002_page_views.sql` | `page_views`, composite indexes, RLS |
| `20260507000003_admin.sql` | `is_admin` + `is_suspended` on profiles |
| `20260507000004_api_keys.sql` | `api_keys` table, RLS |
| `20260508000001_subscriptions.sql` | All subscription tables, feature definitions, seeded plan data, RLS, `increment_feature_usage()` RPC |

**Apply new migrations:**
```bash
cd tether-backend
npx supabase db push
```
