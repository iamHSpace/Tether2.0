import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Paths that don't require authentication.
// /api/auth  — OAuth callback must be reachable before a session exists.
// /c/        — Public creator profile pages (e.g. /c/username)
const PUBLIC_PATHS = ["/login", "/signup", "/onboarding", "/auth", "/api/auth", "/c/"];

// Paths that logged-in users should be bounced away from (to /dashboard).
// /c/ is intentionally excluded — authenticated users should still be able
// to view public creator profiles.
const AUTH_REDIRECT_PATHS = ["/login", "/signup", "/onboarding", "/auth"];

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

  const isPublicPath = PUBLIC_PATHS.some(p => path.startsWith(p));

  if (!user && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from auth pages and the root landing page.
  // Public creator profiles (/c/*) are always viewable regardless of session.
  const isAuthPage = path === "/" || AUTH_REDIRECT_PATHS.some(p => path.startsWith(p));
  if (user && isAuthPage) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
