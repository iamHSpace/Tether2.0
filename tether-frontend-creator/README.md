# Tether Frontend

The UI layer for Tether 2.0 — a creator intelligence platform. Runs on port 3001, talks to `tether-backend` on port 3000.

## Pages

| Route | Page |
|---|---|
| `/login` | Sign in (email/password + Google OAuth) |
| `/signup` | Create account |
| `/onboarding` | 3-step new-user wizard |
| `/dashboard` | Creator dashboard with YouTube stats |
| `/settings` | Profile, connections, notifications, account |
| `/[username]` | Public shareable profile page |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
NEXT_PUBLIC_BACKEND_URL=http://127.0.0.1:3000
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3001
```

### 3. Make sure tether-backend is running first

```bash
# In tether-backend/
supabase start
npm run dev          # → http://127.0.0.1:3000
```

### 4. Start the frontend

```bash
npm run dev          # → http://127.0.0.1:3001
```

## Architecture

- Auth is handled via **Supabase browser client** (`@supabase/ssr`) — same Supabase project as the backend
- YouTube OAuth flows go through the **backend** (`NEXT_PUBLIC_BACKEND_URL/api/oauth/youtube`)
- YouTube stats are fetched from the **backend** API (`/api/youtube/stats`)
- The public profile page (`/[username]`) reads from Supabase directly — no login required
- `middleware.ts` protects all routes except `/login`, `/signup`, `/onboarding`, and `/:username`
