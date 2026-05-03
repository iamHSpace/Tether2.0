# Tether 2.0 — Project Context

## What is Tether?
Tether is a **verified creator intelligence platform**. Creators connect their social accounts (YouTube, Instagram) and get a shareable public profile that shows live, API-pulled metrics — not self-reported numbers. Brands and agencies use these profiles to verify a creator's reach before working with them.

## Architecture

```
tether-frontend  (Next.js 15, port 3001)
      │
      │  REST API (Bearer token auth)
      ▼
tether-backend   (Next.js 15, port 3000)
      │
      │  Supabase JS (service-role key, bypasses RLS)
      ▼
Supabase (local port 54321 / hosted)
  ├── auth.users       (Supabase managed)
  ├── profiles
  ├── platform_tokens
  └── metric_snapshots

Supabase Edge Functions (Deno)
  └── daily-snapshot   (cron: 00:05 UTC daily)
```

The frontend and backend are **separate Next.js apps** running on different ports. The frontend never touches the database directly — all data flows through the backend API with `Authorization: Bearer <supabase_jwt>` headers.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, TypeScript, Tailwind CSS |
| Backend | Next.js 15 App Router, TypeScript |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Edge functions | Supabase Edge Runtime (Deno 2) |
| Auth | Supabase Auth — Google OAuth (PKCE) + email/password |
| Token encryption | AES-256-GCM, key = SHA-256(ENCRYPTION_SECRET) |
| Scheduling | pg_cron + pg_net → Edge Function |

## Local Dev Setup

```bash
# 1. Start Supabase
cd tether-backend && supabase start

# 2. Start backend (port 3000)
cd tether-backend && npm run dev

# 3. Start frontend (port 3001)
cd tether-frontend && npm run dev
```

Both apps must be running. Supabase Studio is at http://localhost:54323.

## Environment Variables

### tether-frontend/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
```

### tether-backend/.env.local
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_client_secret>
ENCRYPTION_SECRET=<any_strong_string>
FRONTEND_URL=http://127.0.0.1:3001
CRON_SECRET=<strong_random_string>
# Optional — only needed for Instagram OAuth:
INSTAGRAM_CLIENT_ID=<facebook_app_id>
INSTAGRAM_CLIENT_SECRET=<facebook_app_secret>
```

### supabase/.env.local (edge function secrets)
```
ENCRYPTION_SECRET=<same as backend>
GOOGLE_CLIENT_ID=<same as backend>
GOOGLE_CLIENT_SECRET=<same as backend>
CRON_SECRET=<same as backend>
```

## Database Schema (summary)

| Table | Purpose |
|---|---|
| `profiles` | One row per user. Username, bio, metric_visibility JSONB |
| `platform_tokens` | Encrypted OAuth tokens per connected platform |
| `metric_snapshots` | Time-series metric history (written on every stats fetch + daily cron) |

## Current Features
- Google OAuth login (PKCE, cookie-based)
- Email/password login
- Multi-step onboarding
- YouTube OAuth connect — fetches channel stats + recent videos
- Instagram OAuth connect (requires Facebook Developer App)
- Public creator profiles at `/c/:username`
- Dashboard with platform connections + metric visibility toggles
- Settings: username editing with live availability check
- Daily automated metric snapshot via Edge Function cron job
- Growth history stored in `metric_snapshots` for charting

## Public Profile URL Structure
```
/c/:username   → public creator profile (no auth required)
```
Old `/[username]` route no longer exists.

## Key Design Decisions
- Frontend uses **Bearer token** auth (not cookies) to call the backend — works cross-origin
- Backend uses **service-role key** for all DB operations (bypasses RLS) since auth is enforced at the API layer
- OAuth tokens are **AES-256-GCM encrypted** before storage
- YouTube OAuth uses a **signed HMAC state** to embed userId so the callback doesn't need a session cookie
- Metric snapshots are written **fire-and-forget** (non-blocking) on every stats fetch
- The daily cron uses `CRON_SECRET` Bearer auth since pg_cron doesn't produce Supabase JWTs
