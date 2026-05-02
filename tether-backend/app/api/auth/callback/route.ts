import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { routes } from "@/lib/config";

/**
 * OAuth callback handler — PKCE flow
 *
 * After Google authenticates the user, Supabase redirects here with a
 * short-lived `code`.  We exchange that code for a full session and set
 * the resulting auth cookies on the response before redirecting home.
 *
 * Flow:
 *   Browser → Google → Supabase (/auth/v1/callback on port 54321)
 *     → here (/api/auth/callback?code=...) → / (dashboard)
 */
export async function GET(req: Request) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorParam) {
    console.error("[auth/callback] OAuth error:", errorParam, errorDescription);
    return NextResponse.redirect(
      `${routes.login}?error=${encodeURIComponent(errorDescription ?? errorParam)}`
    );
  }

  if (!code) {
    console.error("[auth/callback] Missing code parameter");
    return NextResponse.redirect(`${routes.login}?error=missing_code`);
  }

  const cookieStore = await cookies();

  // Build the redirect response first so the setAll handler can stamp
  // session cookies onto it before we return it.
  const response = NextResponse.redirect(`${routes.home}${next === "/" ? "" : next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
    return NextResponse.redirect(
      `${routes.login}?error=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
