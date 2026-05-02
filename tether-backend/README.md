# Tether 2.0

A creator intelligence platform. Creators connect their social accounts, get a unified analytics dashboard, and share a live verified metrics link with brands and agencies — no screenshots, no manual reports.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Auth | Supabase Auth — Google OAuth, PKCE flow |
| Platform APIs | YouTube Data API v3 |
| Encryption | AES-256-GCM (Node.js `crypto`) |
| Local dev | Supabase CLI + Docker |

---

## Project Structure

```
app/
  page.tsx                              # Dashboard (logged in) or sign-in (logged out)
  login/page.tsx                        # Google OAuth entry point (client component)
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
  config.ts                             # Single source of truth for all config constants
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
```

---

## Local Setup

### Prerequisites

- Node.js 18+
- Docker Desktop (for Supabase local)
- Supabase CLI (`npm install -g supabase`)
- A Google Cloud project with OAuth 2.0 credentials

### 1. Clone and install

```bash
git clone <repo-url>
cd tether-backend
npm install
```

### 2. Create environment files

**`.env.local`** (read by Next.js — gitignored):
```
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start output>
ENCRYPTION_SECRET=<any random string, min 32 chars>
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
YOUTUBE_REDIRECT_URI=http://127.0.0.1:3000/api/oauth/youtube/callback
```

**`.env`** (read by Supabase CLI — gitignored):
```
GOOGLE_CLIENT_ID=<from Google Cloud Console>
GOOGLE_CLIENT_SECRET=<from Google Cloud Console>
```

> Both files are gitignored. Never commit them.  
> The Supabase CLI reads from `.env` (or shell env) — it **ignores** `.env.local`.

### 3. Google Cloud Console

In your OAuth 2.0 client, add **both** of these to **Authorised redirect URIs**:

```
http://127.0.0.1:54321/auth/v1/callback
http://127.0.0.1:3000/api/oauth/youtube/callback
```

The first is for Supabase login. The second is for the YouTube connect flow.

### 4. Start Supabase

```bash
supabase start
```

Copy the `anon key` and `service_role key` from the output into `.env.local`.

### 5. Apply migrations

```bash
supabase db reset
# or, to apply new migrations only:
supabase migration up
```

### 6. Start the app

```bash
npm run dev
```

Open **http://127.0.0.1:3000**

> Always use `127.0.0.1`, not `localhost`. Browsers treat them differently for cookies — mixing them breaks the session.

---

## Auth Flow

```
Browser → Google → Supabase (54321) → /api/auth/callback → / (dashboard)
```

Session is stored in cookies and refreshed by `middleware.ts` on every request. Always use `supabase.auth.getUser()` server-side — never `getSession()` alone.

Full details in [CONTEXT.md](./CONTEXT.md).

---

## YouTube Integration

Once logged in, click **Connect YouTube** on the dashboard:

```
Dashboard → /api/oauth/youtube → Google consent → /api/oauth/youtube/callback
→ tokens encrypted (AES-256-GCM) → stored in platform_tokens → dashboard shows stats
```

OAuth tokens are stored encrypted at rest. The encryption key is derived from `ENCRYPTION_SECRET` via SHA-256.

---

## Configuration

All magic strings (URLs, platform names, API endpoints, algorithm names) live in **`lib/config.ts`**. Nothing is hardcoded elsewhere.

To switch environments (local → staging → production), change one env var:
```
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on http://127.0.0.1:3000 |
| `npm run build` | Production build |
| `npm run lint` | Lint |
| `supabase start` | Start local Supabase (requires Docker) |
| `supabase stop` | Stop local Supabase |
| `supabase db reset` | Reset DB and re-apply all migrations |

---

## Current Status

| Phase | Status |
|---|---|
| Phase 1 — Foundation (Next.js, Supabase Auth, PKCE login) | ✅ Complete |
| Phase 2 — YouTube Integration (OAuth, encrypted tokens, stats dashboard) | ✅ Complete |
| Phase 3 — Instagram Integration | 🔲 Next |
| Phase 4 — Public Sharing Layer (`/c/[username]`) | 🔲 Planned |
| Phase 5 — Monetization (API keys, Stripe) | 🔲 Planned |
