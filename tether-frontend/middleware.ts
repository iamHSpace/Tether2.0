import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that don't require authentication.
// /api/auth  — OAuth callback (/api/auth/callback) must be reachable before
//              a session exists, otherwise the middleware redirects it to /login
//              and the PKCE code exchange never happens.
const PUBLIC_PATHS = ["/login", "/signup", "/onboarding", "/auth", "/api/auth"];

// Known app routes that must NOT be treated as public profile pages.
// The isPublicProfile regex below matches any single-segment path like
// /dashboard or /settings — these must be explicitly excluded so
// unauthenticated users are properly redirected to /login.
const APP_ROUTES = new Set(["dashboard", "settings", "profile", "analytics", "connections"]);

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Public profile pages are always accessible, but known app routes are not.
  const isPublicProfile = /^\/[a-zA-Z0-9_-]+$/.test(path) &&
    !PUBLIC_PATHS.some(p => path.startsWith(p)) &&
    path !== "/" &&
    !APP_ROUTES.has(path.slice(1));

  const isPublicPath = PUBLIC_PATHS.some(p => path.startsWith(p));

  if (!user && !isPublicPath && !isPublicProfile) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth/landing pages to the portal.
  // Root "/" is the landing page; also redirect away from login/signup pages.
  // API routes are excluded so the OAuth callback can run even with an active session.
  if (user && (path === "/" || (isPublicPath && !path.startsWith("/api/")))) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
