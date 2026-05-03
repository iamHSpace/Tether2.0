import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/auth/login/google
 *
 * Initiates the Google OAuth / PKCE flow.
 *
 * Why a Route Handler instead of a Server Action:
 *   A server action's redirect() is handled by Next.js internals which may
 *   flush cookie writes to the response only after the action completes.
 *   With a route handler we build the 302 response ourselves and explicitly
 *   stamp every Set-Cookie header Supabase produces onto it — so the PKCE
 *   code verifier is guaranteed to reach the browser before the Google
 *   consent screen opens.
 *
 * Flow:
 *   Browser → GET /api/auth/login/google
 *          → 302 to accounts.google.com  (Set-Cookie: sb-…-code-verifier=…)
 *          → 302 back to /api/auth/callback?code=…  (browser sends cookie)
 *          → exchange code for session  → 302 to /dashboard
 */
export async function GET(req: Request) {
  const cookieStore = await cookies();
  // Derive the app origin from the incoming request so that the redirect URL
  // and the Set-Cookie domain always match the browser's actual origin.
  const reqUrl = new URL(req.url);
  const appUrl = `${reqUrl.protocol}//${reqUrl.host}`;

  // Capture whatever cookies Supabase wants to set (the PKCE code verifier)
  const pendingCookies: {
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          // Don't write to the incoming request's cookie store — instead
          // collect them and apply them to the redirect response below.
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/api/auth/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    const msg = error?.message ?? "oauth_failed";
    return NextResponse.redirect(
      `${appUrl}/login?error=${encodeURIComponent(msg)}`
    );
  }

  // Build the redirect and stamp every pending cookie onto it
  const response = NextResponse.redirect(data.url);
  pendingCookies.forEach(({ name, value, options }) => {
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2]
    );
  });

  return response;
}
