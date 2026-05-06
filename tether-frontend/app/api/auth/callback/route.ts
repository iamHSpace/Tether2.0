import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * GET /api/auth/callback
 *
 * Handles the PKCE code exchange for the frontend app (port 3001).
 *
 * Flow:
 *   Browser → Google → Supabase (port 54321) → here (?code=...) → /dashboard
 *
 * The response is built BEFORE the Supabase client is created so that
 * setAll() can stamp session cookies directly onto the redirect response.
 */
export async function GET(req: Request) {
  const url   = new URL(req.url);
  const code  = url.searchParams.get("code");
  const next  = url.searchParams.get("next") ?? "/dashboard";
  const error = url.searchParams.get("error");
  const errorDesc = url.searchParams.get("error_description");

  // Always derive the base URL from the incoming request so the post-auth
  // redirect goes back to the same origin that the browser is actually on.
  const appUrl = `${url.protocol}//${url.host}`;

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/login?error=${encodeURIComponent(errorDesc ?? error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/login?error=missing_code`);
  }

  const cookieStore = await cookies();

  // Build the redirect response first so setAll can write cookies onto it
  const response = NextResponse.redirect(`${appUrl}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[frontend/auth/callback] exchange error:", exchangeError.message);
    return NextResponse.redirect(
      `${appUrl}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  return response;
}
