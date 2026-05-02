# Tether 2.0 — Project Context

## Vision

Tether 2.0 is a creator intelligence platform. Creators connect their social accounts, get a unified analytics dashboard, and share a live verified metrics link with brands and agencies — no screenshots, no manual reports.

---

## Core Problem

**Creators** manually share analytics screenshots, lack standardised reporting, and cannot give agencies real-time data access.

**Agencies** cannot verify creator metrics and have no unified view across platforms.

Tether solves this with a **live, shareable analytics layer** backed by verified OAuth data.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth — Google OAuth, PKCE flow |
| Platform APIs | YouTube Data API v3 |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Local dev | Supabase CLI + Docker |

---

## Project Structure

```
tether-backend/
  app/
    page.tsx                              # Dashboard (logged in) or sign-in (logged out)
    layout.tsx
    login/
      page.tsx                            # Google OAuth entry point (client component)
    api/
      auth/
        callback/route.ts                 # PKCE code exchange → session cookies
        logout/route.ts                   # Sign out → clear cookies → redirect
      me/
        route.ts                          # Returns current user from session cookie
      oauth/
        youtube/
          route.ts                        # Redirect to Google YouTube consent screen
          callback/route.ts               # Exchange code → encrypt → store tokens
      youtube/
        stats/route.ts                    # Fetch channel stats + recent videos

  components/
    YouTubeStats.tsx                      # Client component — fetches /api/youtube/stats

  lib/
    config.ts                             # ← Single source of truth for all config constants
    supabaseClient.ts                     # Browser Supabase client (createBrowserClient)
    supabaseServer.ts                     # Server Supabase client (createServerClient + cookies)
    supabase.ts                           # Service-role client (admin/server-only ops)
    encryption.ts                         # AES-256-GCM encrypt / decrypt for token storage
    youtube.ts                            # YouTube OAuth + Data API v3 helpers

  middleware.ts                           # Refreshes auth token on every request (critical)

  supabase/
    config.toml                           # Local Supabase config (Google OAuth enabled)
    migrations/
      20260501162942_init_schema.sql      # Initial schema (users, profiles, platform_connections)
      20260502000001_create_platform_tokens.sql  # platform_tokens table + RLS

  .env                                    # Supabase CLI reads this (gitignored)
  .env.local                              # Next.js reads this (gitignored)
```

---

## Configuration

All magic strings (URLs, platform names, API endpoints, algorithm names) live in **`lib/config.ts`**. Nothing is hardcoded elsewhere.

To switch environments (local → staging → production), change exactly **one** env var:

```
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

`lib/config.ts` exports:

| Export | Contents |
|---|---|
| `routes` | All app URLs (home, login, logout, OAuth endpoints, API routes) |
| `platforms` | Platform identifier strings (`"youtube"`, `"instagram"`) |
| `youtube` | Google/YouTube API URLs, OAuth scopes, defaults |
| `encryption` | Algorithm name, IV byte length |

---

## Authentication Architecture

### Supabase Login Flow (PKCE — browser-initiated)

```
1. User clicks "Continue with Google"       (login/page.tsx)
2. supabaseClient.auth.signInWithOAuth()
     → fetches http://127.0.0.1:54321/auth/v1/authorize
     → stores PKCE code_verifier in a cookie
     → returns a Google OAuth URL
3. Browser navigates to the Google OAuth URL
4. Google authenticates the user
5. Google redirects → Supabase:             http://127.0.0.1:54321/auth/v1/callback
6. Supabase exchanges code internally
7. Supabase redirects → our app:            /api/auth/callback?code=...
8. callback/route.ts calls exchangeCodeForSession(code)
     → reads PKCE verifier from cookie
     → exchanges for a full session
     → writes session cookies onto the redirect response
9. Browser follows redirect to / with session cookies set
10. middleware.ts refreshes the token on every subsequent request
```

### Why `middleware.ts` is critical

Without it, the session JWT is never refreshed between requests. The user appears logged in but every server-side `getUser()` call fails after token expiry. The middleware intercepts every request, calls `getUser()` (which silently refreshes if needed), and writes updated cookies to the response.

### Server-side auth rule

Always use `supabase.auth.getUser()` in server components and route handlers — **never** `getSession()` alone. `getUser()` validates the JWT against the Supabase auth server. `getSession()` only reads the local cookie and must not be trusted for access control.

---

## YouTube Integration

### Connect Flow

```
1. User clicks "Connect YouTube"            (dashboard)
2. GET /api/oauth/youtube
     → verifies Tether session
     → redirects to Google consent screen (youtube.readonly scope)
3. User grants access
4. Google redirects → /api/oauth/youtube/callback?code=...
5. callback/route.ts:
     → exchanges code for access + refresh tokens
     → fetches channel info (name, handle, thumbnail, uploads playlist ID)
     → encrypts both tokens with AES-256-GCM
     → upserts into platform_tokens (user_id + platform unique)
6. Redirect to dashboard with ?youtube_connected=true
7. Dashboard renders <YouTubeStats /> client component
8. YouTubeStats fetches GET /api/youtube/stats
     → decrypts tokens, auto-refreshes if expiring within 5 min
     → fetches channel statistics + recent 5 videos via YouTube Data API v3
     → returns structured JSON
```

### Token Storage

Tokens are stored in the `platform_tokens` table, encrypted at rest with AES-256-GCM before being written to the database. The encryption key is derived from `ENCRYPTION_SECRET` via SHA-256. The format stored per token is `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.

RLS policies ensure users can only access their own rows when using the anon/user client. Server-side routes use the service-role client (bypasses RLS) to read tokens for API calls.

---

## Database Schema

### `platform_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → `auth.users(id)` ON DELETE CASCADE |
| `platform` | TEXT | `'youtube'`, `'instagram'`, … |
| `access_token` | TEXT | AES-256-GCM encrypted |
| `refresh_token` | TEXT | AES-256-GCM encrypted |
| `token_expiry` | TIMESTAMPTZ | When access token expires |
| `scope` | TEXT | Granted OAuth scopes |
| `platform_user_id` | TEXT | e.g. YouTube channel ID |
| `platform_username` | TEXT | e.g. YouTube channel name |
| `metadata` | JSONB | Platform-specific extras (handle, thumbnail, uploadsPlaylistId) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated via trigger |

Unique constraint on `(user_id, platform)` — reconnecting updates the existing row.

---

## Key Constraints (hard-won)

| Constraint | Why |
|---|---|
| OAuth must start in the browser | PKCE `code_verifier` is stored in a cookie — cannot be done server-side only |
| `127.0.0.1` everywhere, not `localhost` | Browsers treat these differently for cookies. Mixing them breaks the session. We use `127.0.0.1` throughout. |
| `supabase start` before `npm run dev` | `signInWithOAuth` makes a real fetch to port 54321. If Supabase isn't up, it throws and the button silently does nothing. |
| `.env` for Supabase CLI, `.env.local` for Next.js | The CLI reads `env(GOOGLE_CLIENT_ID)` from shell env / `.env`. It ignores `.env.local`. Both files must exist. |
| `--hostname 127.0.0.1` in dev script | Without it, HMR WebSocket binds to `localhost` but the browser connects via `127.0.0.1` — WebSocket fails and hot-reload breaks. |
| Google Cloud Console: two redirect URIs needed | `http://127.0.0.1:54321/auth/v1/callback` (Supabase login) AND `http://127.0.0.1:3000/api/oauth/youtube/callback` (YouTube connect) |
| `skipBrowserRedirect: true` in signInWithOAuth | Without it, errors during OAuth are silently swallowed. With it, we catch and display them. |
| `prompt: consent` + `access_type: offline` for YouTube | Required to always receive a `refresh_token`. Google only sends it on first consent otherwise. |

---

## Environment Variables

### `.env.local` (Next.js — gitignored)

```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
ENCRYPTION_SECRET=<random string, min 32 chars>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
YOUTUBE_REDIRECT_URI=http://127.0.0.1:3000/api/oauth/youtube/callback
```

### `.env` (Supabase CLI — gitignored)

```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

---

## Running Locally

```bash
# 1. Start Supabase (Docker must be running)
supabase start

# 2. Apply migrations
supabase db reset   # or: supabase migration up

# 3. Start Next.js
npm run dev

# 4. Open
open http://127.0.0.1:3000
```

---

## Current Status

### Phase 1 — Foundation ✅ COMPLETE

- [x] Next.js 16 App Router structure
- [x] Supabase local setup with Google OAuth
- [x] PKCE login flow (browser → Google → Supabase → app)
- [x] Session stored in cookies, refreshed by middleware on every request
- [x] `/api/me` returns current authenticated user
- [x] Logout invalidates session and clears cookies
- [x] HMR working (`--hostname 127.0.0.1`)

### Phase 2 — YouTube Integration ✅ COMPLETE

- [x] `platform_tokens` table with RLS and encrypted storage
- [x] AES-256-GCM encryption for all stored OAuth tokens
- [x] `lib/config.ts` — all strings centralised, zero hardcoded values
- [x] YouTube OAuth connect flow (`/api/oauth/youtube` → Google → callback)
- [x] Token auto-refresh when expiring within 5 minutes
- [x] `/api/youtube/stats` — channel stats + recent 5 videos
- [x] Dashboard shows YouTube card with subscribers, views, video count, recent videos

### Phase 3 — Instagram Integration 🔲 NEXT

- [ ] Facebook Developer App setup
- [ ] Instagram Graph API OAuth flow
- [ ] Store Instagram tokens in `platform_tokens`
- [ ] `/api/instagram/stats` endpoint
- [ ] Instagram section on dashboard

### Phase 4 — Public Sharing Layer 🔲 PLANNED

- [ ] Creator generates a public share link (`/c/[username]`)
- [ ] Public page shows live metrics — no login required
- [ ] Permission controls (what data to expose)

### Phase 5 — Monetization 🔲 PLANNED

- [ ] API key system
- [ ] Rate limiting
- [ ] Billing via Stripe

---

## Guiding Principle

> Debug in order: Routing → Server runtime → Auth flow → Data layer.
> Never skip a layer.
