import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/api/auth", "/c/", "/suspended"];
const AUTH_REDIRECT_PATHS = ["/login", "/signup", "/auth"];

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
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user) {
    const userType = (user.user_metadata?.user_type as string | undefined) ?? "creator";
    const isAdmin  = user.user_metadata?.is_admin === true;
    const isAuthPage = path === "/" || AUTH_REDIRECT_PATHS.some(p => path.startsWith(p));

    // Admin guard — non-admins redirected away from /admin
    if (path.startsWith("/admin") && !isAdmin) {
      return NextResponse.redirect(new URL(userType === "business" ? "/discover" : "/dashboard", request.url));
    }

    // Suspension check — suspended users can only see /suspended
    if (!isAdmin && !path.startsWith("/suspended")) {
      // We check is_suspended from user_metadata if available; otherwise allow through
      // (profiles.is_suspended is enforced on full page loads via the suspended page redirect)
      if (user.user_metadata?.is_suspended === true) {
        return NextResponse.redirect(new URL("/suspended", request.url));
      }
    }

    // Role guards — wrong-role users get bounced to their home
    if (userType === "business" && (path.startsWith("/dashboard") || path.startsWith("/onboarding") || path.startsWith("/businesses"))) {
      return NextResponse.redirect(new URL("/discover", request.url));
    }
    if (userType === "creator" && (path.startsWith("/discover") || path.startsWith("/saved"))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // /messages and /admin are accessible to both roles (with admin guard above)

    // Redirect away from auth/landing pages to role-appropriate home
    if (isAuthPage) {
      return NextResponse.redirect(new URL(
        isAdmin ? "/admin/users" : userType === "business" ? "/discover" : "/dashboard",
        request.url
      ));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
