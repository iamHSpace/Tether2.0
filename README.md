# Statvora

Creator intelligence platform. Creators connect their social accounts, get a unified analytics dashboard, and share a verified metrics link with brands and agencies — no screenshots, no manual reports.

---

## Repo layout

```
Tether2.0/
  tether-backend/    # Next.js 15 API-only app — all DB writes, YouTube/Instagram OAuth, edge functions
  tether-frontend/   # Next.js 15 fullstack app — single domain, all roles + admin panel
  .github/workflows/deploy.yml  # CI/CD — auto-deploys both apps on every push to main
```

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (Postgres + Auth + Realtime) |
| Styling | Tailwind CSS 3.4 |
| Deployment | Vercel (separate projects per app) |
| Payments | Stripe (subscription plans) |
| Charts | Recharts |

---

## Quick start

```bash
# 1. Clone
git clone <repo-url> && cd Tether2.0

# 2. Install dependencies
cd tether-backend  && npm install
cd ../tether-frontend && npm install

# 3. Set up env files — see CLAUDE.md "Local dev setup" section for all required vars
cp tether-backend/.env.local.example  tether-backend/.env.local   # edit with your values
cp tether-frontend/.env.local.example tether-frontend/.env.local  # edit with your values

# 4. Run both apps (two terminals)
cd tether-backend  && npm run dev   # → http://127.0.0.1:3000
cd tether-frontend && npm run dev   # → http://127.0.0.1:3001
```

> Always use `127.0.0.1`, not `localhost` — cookie domain matching requires it.

---

## Production

| | URL |
|---|---|
| App | https://statvora.in |
| API | https://api.statvora.in |
| Admin panel | https://statvora.in/admin |
| API docs | https://statvora.in/docs |
| Pricing | https://statvora.in/pricing |
| Supabase | https://vywuvfjjqvanimizbero.supabase.co |

Pushes to `main` auto-deploy both apps via GitHub Actions.

---

## Documentation

| Doc | What's inside |
|---|---|
| [CLAUDE.md](./CLAUDE.md) | Quick-reference for engineers: roles, routes, env vars, auth flows, local dev setup, admin procedures |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, request flows, OAuth flows, rendering strategy, background jobs, performance decisions |
| [docs/BUSINESS_MODEL.md](./docs/BUSINESS_MODEL.md) | Customer segments, pricing tiers, feature gates, Stripe setup, go-to-market notes |
| [docs/DATABASE.md](./docs/DATABASE.md) | Full schema for all 15 tables, Postgres RPCs, indexes, migration history |
| [docs/API.md](./docs/API.md) | All 47 API endpoints — auth, params, request/response shapes, error codes |
