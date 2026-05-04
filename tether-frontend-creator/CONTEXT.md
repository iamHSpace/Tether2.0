# tether-frontend — Context

Next.js 15 App Router app running on **port 3001**. Handles all user-facing UI. Never queries the database directly — all data goes through tether-backend via authenticated REST calls.

## Route Map

| Route | Auth | Purpose |
|---|---|---|
| `/` | redirects | Logged-in → `/dashboard`, guest → `/login` |
| `/login` | public | Email + Google OAuth login |
| `/signup` | public | Email signup |
| `/onboarding` | required | Multi-step creator profile setup |
| `/dashboard` | required | Main portal: connections, metrics, visibility settings |
| `/settings` | required | Profile edit, username, platform connections |
| `/c/[username]` | public | Shareable public creator profile |
| `/api/auth/callback` | public | PKCE code exchange after Google OAuth |
| `/api/auth/login/google` | public | Initiates Google OAuth (server-side, stamps PKCE cookies) |

## Auth Flow

### Google OAuth (PKCE)
1. User clicks "Continue with Google" on `/login`
2. `supabase.auth.signInWithOAuth()` called client-side with `redirectTo: window.location.origin + /api/auth/callback`
3. Browser redirects to Google → back to `/api/auth/callback?code=...`
4. Callback server route exchanges code for session, stamps cookies on redirect response
5. Browser lands on `/dashboard` with session cookies set

### Session Management
- `middleware.ts` runs on every request, calls `supabase.auth.getUser()` to validate session
- Unauthenticated requests to protected routes → redirect to `/login`
- Authenticated requests to auth pages (`/login`, `/signup`, etc.) → redirect to `/dashboard`
- `/c/*` routes are always public — authenticated users can still view them

## Middleware Logic (`middleware.ts`)

```
PUBLIC_PATHS        = [/login, /signup, /onboarding, /auth, /api/auth, /c/]
AUTH_REDIRECT_PATHS = [/login, /signup, /onboarding, /auth]

if (!user && !isPublicPath)       → redirect to /login
if (user && isAuthPage)           → redirect to /dashboard
/c/* paths: always pass through regardless of session
```

## Key Files

### `lib/supabase.ts`
Browser Supabase client (`createBrowserClient`). Used by login page and dashboard for session access.

### `lib/api.ts`
Typed HTTP client for tether-backend. All authenticated calls use `Authorization: Bearer <access_token>`.

```typescript
api.youtube.stats()              // GET /api/youtube/stats
api.youtube.connect()            // POST /api/oauth/youtube → redirect to Google
api.instagram.connect()          // POST /api/oauth/instagram → redirect to Facebook
api.profile.get()                // GET /api/profile
api.profile.update(data)         // PUT /api/profile
api.profile.updateMetrics(vis)   // PUT /api/profile { metric_visibility }
api.profile.checkUsername(name)  // GET /api/profile/check-username?username=
api.creators.get(username)       // GET /api/creators/:username (public, no auth)
```

### `lib/utils.ts`
```typescript
fmt(n)           // 1_400_000 → "1.4M", 1200 → "1.2K"
timeAgo(dateStr) // ISO date → "Today", "3d ago", "Jan 5"
cn(...classes)   // Tailwind class merger
```

### `components/layout/Sidebar.tsx`
Left navigation. Links: Dashboard, Settings. Sign out button. User pill (username + email) at bottom.

### `components/ui/Icons.tsx`
~20 inline SVG icons exported as React components. No external icon library dependency.

## Dashboard (`/dashboard`)

Three sections rendered in order:

1. **Platform Connections** — YouTube and Instagram connect/status cards. Connected state shows channel info + "Refresh metrics" button (re-fetches and updates state in place). Disconnected state shows "Connect" button.

2. **Metric Visibility** — Toggle grid for 6 metrics: `subscribers`, `total_views`, `video_count`, `avg_views`, `view_chart`, `recent_videos`. Each toggle auto-saves to the backend (debounced to single PUT per change). Shows "Saved ✓" on success.

3. **YouTube Analytics** — Stat cards, sparkline charts, recent videos list. Only shown when YouTube is connected.

## Settings (`/settings`)

Four tabs: Profile, Connections, Notifications, Account.

**Profile tab** — username field has live availability checking:
- Debounce: 450ms after keystroke
- Calls `GET /api/profile/check-username?username=`
- Shows spinner → green ✓ (available) or red ✕ (taken/invalid)
- Border and hint text update to match state
- Save button disabled while checking or when taken
- After save: shows `tether.so/c/username` as the live profile URL

**Connections tab** — "Re-authorise" button for YouTube (triggers full OAuth re-connect, used only when token expires).

## Public Profile (`/c/[username]`)

- Fetches `GET /api/creators/:username` (public endpoint, no auth)
- Respects `metric_visibility` from the creator's profile
- Shows YouTube section with metric pills only for enabled metrics
- Shows Instagram section if connected
- Always accessible to everyone — logged-in users are not redirected away

## Types (from `lib/api.ts`)

```typescript
interface MetricVisibility {
  subscribers: boolean; total_views: boolean; video_count: boolean;
  avg_views: boolean;   view_chart: boolean;  recent_videos: boolean;
}

interface Profile {
  id: string; username: string | null; full_name: string | null;
  bio: string | null; website: string | null; avatar_url: string | null;
  creator_stage: string | null; aspiration: string | null;
  platform_reason: string | null; metric_visibility: MetricVisibility | null;
}

interface YouTubeStatsResponse {
  channel: ChannelStats; videos: VideoSummary[]; connectedAt: string;
}

interface PlatformInfo {
  platform: string; platform_username: string; platform_user_id: string;
  metadata: Record<string, unknown>; created_at: string;
}
```

## Styling
- Tailwind CSS 3.4 with custom brand colour (`brand-600` = `#7c3aed`, purple)
- Component classes defined in `globals.css`: `.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.stat-card`, `.sidebar-link`
- Inter font (Google Fonts, self-hosted via `next/font`)
- No component library — all UI is custom
