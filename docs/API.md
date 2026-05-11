# Statvora — API Reference

Base URL (production): `https://api.statvora.in`
Base URL (local dev): `http://127.0.0.1:3000`

---

## Authentication

Most endpoints require one of two auth methods:

**Session auth** — Supabase session JWT in the Authorization header:
```
Authorization: Bearer <supabase_access_token>
```

**API key auth** — Developer API key (business tier only):
```
Authorization: Bearer tth_<key>
```

Endpoints marked **Public** require no authentication.

---

## Auth & Identity

### `GET /api/auth/google/code`

Google OAuth2 code exchange. Called by the browser after Google redirects back.

**Query params:** `code`, `state`
**Response:** Redirects to `/auth/google/complete` (frontend).
**Auth:** None (OAuth callback)

---

### `POST /api/auth/logout`

Sign out the current user. Clears session cookies.

**Auth:** Session

---

### `GET /api/me`

Get the authenticated user's ID and email.

**Auth:** Session

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

---

### `POST /api/auth/resolve-email`

Resolve a username to its email address. Used by the login page to support username-based login.

**Auth:** None (public)

**Request body:**
```json
{ "identifier": "iamhspace" }
```

**Response:**
```json
{ "email": "user@example.com" }
```

**Errors:** `404` if username not found.

---

## Profile

### `GET /api/profile`

Get the authenticated user's full profile.

**Auth:** Session

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "username": "jane4x9m2k",
    "full_name": "Jane Smith",
    "company_name": null,
    "user_type": "creator",
    "bio": "Tech creator",
    "website": "https://jane.dev",
    "avatar_url": null,
    "category": "Tech",
    "career_stage": "Mid",
    "location": "Mumbai",
    "metric_visibility": { "subscribers": true, "total_views": true, "video_count": true, "avg_views": true, "view_chart": true, "recent_videos": true },
    "is_admin": false,
    "is_suspended": false,
    "last_active_at": "2024-11-01T09:00:00Z",
    "created_at": "2024-05-01T00:00:00Z",
    "updated_at": "2024-11-01T09:00:00Z"
  },
  "email": "jane@example.com"
}
```

---

### `PUT /api/profile`

Update the authenticated user's profile.

**Auth:** Session

**Request body (all fields optional):**
```json
{
  "username": "newusername",
  "full_name": "Jane Smith",
  "company_name": "Acme Corp",
  "bio": "Short bio",
  "website": "https://example.com",
  "avatar_url": "https://...",
  "category": "Fitness",
  "career_stage": "Growth",
  "location": "Delhi",
  "metric_visibility": { "subscribers": true, "total_views": false }
}
```

**Errors:** `409` if `username` already taken.

---

### `GET /api/profile/check-username`

Check if a username is available.

**Auth:** None (public)

**Query params:** `username=<value>`

**Response:**
```json
{ "available": true }
```

---

### `GET /api/profile/views`

Get view-count widgets for the creator dashboard. Calls the `get_creator_view_stats()` Postgres RPC.

**Auth:** Session (creator only)

**Response:**
```json
{
  "this_week": 142,
  "last_week": 98,
  "daily_counts": [
    { "date": "2024-10-26", "count": 18 },
    { "date": "2024-10-27", "count": 25 }
  ]
}
```

---

## YouTube

### `POST /api/oauth/youtube`

Generate a Google OAuth consent URL for YouTube connection.

**Auth:** Session

**Response:**
```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```

---

### `GET /api/oauth/youtube/callback`

OAuth callback handler. Exchanges the authorization code for tokens, encrypts them, and stores in `platform_tokens`.

**Auth:** None (OAuth callback — state parameter validated via HMAC-SHA256)

**Response:** Redirects to `<FRONTEND_URL>/dashboard?youtube_connected=true` or `?youtube_error=<message>`

---

### `GET /api/youtube/stats`

Fetch the authenticated creator's YouTube channel stats and recent videos.

**Auth:** Session

**Response:**
```json
{
  "channel": {
    "id": "UCxxx",
    "title": "My Channel",
    "subscribers": 12400,
    "totalViews": 1840000,
    "videoCount": 87,
    "publishedAt": "2020-03-15T00:00:00Z",
    "country": "IN"
  },
  "videos": [
    {
      "id": "dQw4w9WgXcQ",
      "title": "My Latest Video",
      "publishedAt": "2024-11-01T10:00:00Z",
      "views": 45200,
      "likes": 1800,
      "comments": 220,
      "thumbnail": "https://i.ytimg.com/..."
    }
  ],
  "connected_at": "2024-05-10T08:00:00Z"
}
```

Side effects: Writes a `metric_snapshots` row; updates `profiles.last_active_at`.

**Errors:**
- `404 { error: "not_connected" }` — no YouTube token
- `401 { error: "token_invalid" }` — token refresh failed

---

## Instagram

### `POST /api/oauth/instagram`

Generate an Instagram OAuth consent URL.

**Auth:** Session

**Response:**
```json
{ "url": "https://www.instagram.com/oauth/authorize?..." }
```

---

### `GET /api/oauth/instagram/callback`

OAuth callback handler. Exchanges short-lived token for long-lived token (60-day), stores encrypted.

**Auth:** None (OAuth callback — state validated)

**Response:** Redirects to `<FRONTEND_URL>/dashboard?instagram_connected=true` or `?instagram_error=<message>`

---

### `GET /api/instagram/stats`

Fetch the authenticated creator's Instagram account stats and recent posts.

**Auth:** Session

**Response:**
```json
{
  "username": "creator_handle",
  "full_name": "Creator Name",
  "profile_picture_url": "https://...",
  "followers_count": 8200,
  "media_count": 134,
  "recent_posts": [
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
  ],
  "token_expires_at": "2025-01-10T08:00:00Z",
  "connected_at": "2024-11-10T08:00:00Z"
}
```

Side effects: Writes a `metric_snapshots` row.

**Errors:**
- `404 { error: "not_connected" }` — no Instagram token
- `404 { error: "token_expired" }` — token expired; row deleted, re-connect required

---

## Creators & Discovery

### `GET /api/creators/:username`

Get a creator's public profile, connected platforms, and latest platform snapshots.

**Auth:** None (public). Backend sets `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`.

**Response:**
```json
{
  "profile": { ...profile fields... },
  "platforms": [
    { "id": "uuid", "platform": "youtube", "connected_at": "..." }
  ],
  "snapshots": {
    "youtube": { "data": { "channel": {...}, "videos": [...] }, "captured_at": "..." },
    "instagram": { "data": { "account": {...}, "posts": [...] }, "captured_at": "..." }
  }
}
```

Uses `get_latest_snapshots()` RPC internally.

---

### `GET /api/business/discover`

Search and filter creators. Business users only.

**Auth:** Session

**Query params:**

| Param | Type | Notes |
|---|---|---|
| `q` | string | Search by username or full_name (pg_trgm ilike) |
| `category` | string | Filter by category |
| `sort` | string | `subscribers`, `total_views`, `avg_views`, `video_count` |
| `order` | string | `asc` or `desc` (default `desc`) |
| `page` | number | Page number (default 1) |
| `limit` | number | Items per page (default 20, max 50) |
| `has_youtube` | boolean | Only creators with connected YouTube |
| `has_instagram` | boolean | Only creators with connected Instagram |
| `min_subscribers` | number | Minimum subscriber count |
| `max_subscribers` | number | Maximum subscriber count |

**Response:**
```json
{
  "creators": [
    {
      "username": "jane4x9m2k",
      "full_name": "Jane Smith",
      "category": "Tech",
      "bio": "...",
      "ytChannel": { "subscribers": 12400, "totalViews": 1840000, ... },
      "platforms": [{ "platform": "youtube" }],
      "is_saved": false
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

---

### `GET /api/business/saved-creators`

List the authenticated business user's saved creators.

**Auth:** Session

**Response:**
```json
{
  "saved": [
    { "id": "uuid", "creator_username": "jane4x9m2k", "saved_at": "..." }
  ]
}
```

---

### `POST /api/business/saved-creators`

Save a creator.

**Auth:** Session

**Request body:**
```json
{ "creator_username": "jane4x9m2k" }
```

**Errors:** `409` if already saved.

---

### `DELETE /api/business/saved-creators`

Unsave a creator.

**Auth:** Session

**Request body:**
```json
{ "creator_username": "jane4x9m2k" }
```

---

### `GET /api/business/saved-creators/batch`

Batch-fetch full creator data for multiple saved creators. Single DB query.

**Auth:** Session

**Query params:** `usernames=jane4x9m2k,john3b7a1x` (comma-separated)

**Response:**
```json
{
  "creators": {
    "jane4x9m2k": { "profile": {...}, "platforms": [...], "snapshots": {...} },
    "john3b7a1x": { "profile": {...}, "platforms": [...], "snapshots": {...} }
  }
}
```

---

### `GET /api/creators/discover-businesses`

Browse business profiles for creators.

**Auth:** Session (creator only)

**Query params:** `q`, `page`, `limit`

**Response:**
```json
{
  "businesses": [
    {
      "id": "uuid",
      "company_name": "Acme Corp",
      "username": "acme6x2m1k",
      "bio": "We make products.",
      "website": "https://acme.com"
    }
  ],
  "total": 34,
  "page": 1
}
```

---

## Messaging

### `GET /api/conversations`

List all conversations for the authenticated user.

**Auth:** Session

**Response:**
```json
{
  "conversations": [
    {
      "id": "uuid",
      "creator": { "id": "uuid", "username": "jane", "full_name": "Jane Smith" },
      "business": { "id": "uuid", "company_name": "Acme Corp", "username": "acme" },
      "last_message_at": "...",
      "unread_count": 2
    }
  ]
}
```

---

### `POST /api/conversations`

Start a new conversation (or return existing one).

**Auth:** Session

**Request body:**
```json
{ "participant_id": "uuid-of-other-user" }
```

**Response:**
```json
{ "conversation": { "id": "uuid", ... } }
```

---

### `GET /api/conversations/:id/messages`

Fetch all messages in a conversation. Marks incoming messages as read.

**Auth:** Session (participant only)

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "sender_id": "uuid",
      "body": "Hello!",
      "is_read": true,
      "created_at": "..."
    }
  ]
}
```

---

### `POST /api/conversations/:id/messages`

Send a message.

**Auth:** Session (participant only)

**Request body:**
```json
{ "body": "Hello! Would love to collaborate." }
```

**Errors:** `400` if body exceeds 2000 characters.

---

## Tracking

### `POST /api/track/view`

Record a page view on a creator's public profile. Called by the invisible `TrackView` client island on every `/c/:username` visit.

**Auth:** None (public, but session read for viewer_type)

**Request body:**
```json
{ "username": "jane4x9m2k" }
```

Captured data: `viewer_type`, country/region/city (via ip-api.com), device type, browser, OS, language, referrer type, referrer URL. Self-views excluded.

**Response:** `200 OK` (always; errors swallowed silently to not affect UX)

---

## Subscriptions & Stripe

### `GET /api/subscriptions/plans`

Get all active subscription plans with their features.

**Auth:** None (public). `Cache-Control: public, s-maxage=60`.

**Response:**
```json
{
  "plans": [
    {
      "id": "uuid",
      "name": "Growth",
      "user_type": "creator",
      "billing_period": "monthly",
      "price_usd": "19.00",
      "stripe_price_id": null,
      "tier_order": 3,
      "features": [
        { "key": "api_access", "name": "API Access", "is_enabled": false, "rate_limit": null }
      ]
    }
  ]
}
```

---

### `GET /api/subscriptions/current`

Get the authenticated user's current subscription and effective plan.

**Auth:** Session

**Response:**
```json
{
  "subscription": {
    "plan_id": "uuid",
    "status": "active",
    "current_period_end": "2025-12-01T00:00:00Z",
    "stripe_subscription_id": "sub_xxx"
  },
  "plan": { "name": "Growth", "tier_order": 3 },
  "features": { "api_access": { "is_enabled": true, "rate_limit": 1000, "rate_period": "day" } }
}
```

If no subscription exists, returns Starter plan defaults.

---

### `POST /api/stripe/checkout`

Create a Stripe Checkout session.

**Auth:** Session

**Request body:**
```json
{ "plan_id": "uuid" }
```

**Response:**
```json
{ "url": "https://checkout.stripe.com/..." }
```

**Errors:** `503` if `stripe_enabled = false`.

---

### `POST /api/stripe/portal`

Create a Stripe Customer Portal session for billing management.

**Auth:** Session

**Response:**
```json
{ "url": "https://billing.stripe.com/..." }
```

---

### `POST /api/stripe/webhook`

Stripe webhook receiver. Verifies `Stripe-Signature` header.

**Auth:** None (webhook; signature verified)

**Handled events:**
- `checkout.session.completed` → create/update `user_subscriptions`
- `customer.subscription.updated` → update status + period
- `customer.subscription.deleted` → set status to `canceled`
- `invoice.payment_failed` → set status to `past_due`

---

## Developer API Keys

### `GET /api/developer/keys`

List own API keys (raw key never returned after creation).

**Auth:** Session (business only)

**Response:**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "My Integration",
      "key_prefix": "tth_a1b2",
      "is_active": true,
      "expires_at": null,
      "last_used_at": "2024-11-01T...",
      "created_at": "2024-10-01T..."
    }
  ]
}
```

---

### `POST /api/developer/keys`

Create a new API key. Returns the raw key **once**.

**Auth:** Session (business only)

**Request body:**
```json
{ "name": "My Integration", "expires_at": "2025-12-31T00:00:00Z" }
```

**Response:**
```json
{
  "key": "tth_a1b2c3d4...68chars",
  "id": "uuid",
  "name": "My Integration"
}
```

**Errors:** `429` if user already has 10 active keys.

---

### `DELETE /api/developer/keys/:id`

Revoke an API key (sets `is_active = false`).

**Auth:** Session (owner only)

---

## v1 Public API (API Key Auth)

All routes prefixed with `/api/v1/`. Use `Authorization: Bearer tth_<key>`.

---

### `GET /api/v1/creators`

Search creators with full metric data.

**Auth:** API key (business)

**Query params:** Same as `/api/business/discover` — `q`, `category`, `sort`, `order`, `page`, `limit`, `min_subscribers`, `max_subscribers`

**Response:** Same shape as `/api/business/discover`

---

### `GET /api/v1/me`

Get the API key owner's business profile.

**Auth:** API key

**Response:** Same as `GET /api/profile`

---

### `PATCH /api/v1/me`

Update own profile. Only `company_name`, `bio`, `website` can be modified via API key.

**Auth:** API key

**Request body:**
```json
{ "company_name": "Acme Corp", "bio": "We run campaigns.", "website": "https://acme.com" }
```

---

### `GET /api/v1/saved`

List saved creators.

**Auth:** API key

**Response:** Same as `GET /api/business/saved-creators`

---

### `POST /api/v1/saved`

Save a creator.

**Auth:** API key

**Request body:** `{ "creator_username": "jane4x9m2k" }`

---

### `DELETE /api/v1/saved`

Unsave a creator.

**Auth:** API key

**Request body:** `{ "creator_username": "jane4x9m2k" }`

---

### `GET /api/docs`

OpenAPI spec JSON. CORS open. Consumed by the Swagger UI at `statvora.in/docs`.

**Auth:** None

---

## Admin Routes

All require `is_admin = true` in the authenticated user's profile.

---

### `GET /api/admin/stats`

Platform-wide totals.

**Response:**
```json
{
  "total_users": 1204,
  "total_creators": 890,
  "total_businesses": 314,
  "active_last_30d": 420,
  "page_views_today": 1840,
  "page_views_week": 12300,
  "page_views_month": 48200
}
```

---

### `GET /api/admin/users`

All user profiles, paginated.

**Query params:** `page`, `limit`, `q` (search), `user_type`, `is_suspended`

**Response:**
```json
{
  "users": [{ ...profile + email }],
  "total": 1204,
  "page": 1
}
```

---

### `PUT /api/admin/users/:id`

Update a user's role, suspension status, or admin flag.

**Request body:**
```json
{ "user_type": "business", "is_suspended": false, "is_admin": false }
```

---

### `DELETE /api/admin/users/:id`

Permanently delete a user via `supabase.auth.admin.deleteUser`. Cascades to profile row.

---

### `GET /api/admin/platform-health`

Per-creator YouTube token status.

**Response:**
```json
{
  "creators": [
    {
      "username": "jane",
      "full_name": "Jane Smith",
      "youtube_connected": true,
      "token_expires_at": "2025-01-01T...",
      "last_snapshot_at": "2024-11-01T...",
      "is_stale": false
    }
  ]
}
```

---

### `POST /api/admin/snapshot/trigger`

Manually invoke the daily-snapshot Supabase Edge Function.

**Response:**
```json
{ "succeeded": 42, "failed": 1, "total": 43 }
```

---

### `GET /api/admin/analytics`

Aggregate page-view analytics.

**Query params:** `days=7|30|90`

**Response:**
```json
{
  "viewer_type_counts": { "business": 840, "creator": 320, "public": 680 },
  "top_countries": [{ "country": "IN", "count": 620 }, ...],
  "device_split": { "desktop": 1100, "mobile": 640, "tablet": 100 },
  "referrer_types": { "direct": 900, "social": 500, "search": 300, "other": 140 },
  "daily_counts": [{ "date": "2024-10-26", "count": 145 }, ...]
}
```

---

### `GET /api/admin/conversations`

All conversations with participant names and last message preview.

**Query params:** `page`, `limit`

---

### `GET /api/admin/conversations/:id`

Full read-only message thread.

---

### `PUT /api/admin/profiles/:id/flag`

Set or unset suspension.

**Request body:**
```json
{ "is_suspended": true }
```

---

### `GET /api/admin/subscriptions/plans`

List all subscription plans.

---

### `PATCH /api/admin/subscriptions/plans`

Batch-update plan pricing or Stripe price IDs.

**Request body:**
```json
{
  "updates": [
    { "id": "uuid", "price_usd": 19.00, "stripe_price_id": "price_xxx", "is_active": true }
  ]
}
```

---

### `GET /api/admin/subscriptions/features`

List all feature definitions with per-plan configuration.

---

### `PUT /api/admin/subscriptions/features`

Upsert plan → feature configuration (enable/disable, set rate limits).

**Request body:**
```json
{
  "plan_id": "uuid",
  "feature_id": "uuid",
  "is_enabled": true,
  "rate_limit": 1000,
  "rate_period": "day"
}
```

---

### `GET /api/admin/settings`

Read all `platform_settings` key-value pairs.

---

### `PUT /api/admin/settings`

Update a setting.

**Request body:**
```json
{ "key": "stripe_enabled", "value": "true" }
```

---

## Error Format

All error responses follow:

```json
{ "error": "Human-readable error message" }
```

Common status codes:
- `400` — Bad request / validation error
- `401` — Missing or invalid auth token
- `403` — Forbidden (feature disabled for plan, or wrong role)
- `404` — Resource not found
- `409` — Conflict (duplicate resource)
- `429` — Rate limit exceeded
- `500` — Internal server error
- `503` — Service unavailable (e.g. Stripe not configured)
