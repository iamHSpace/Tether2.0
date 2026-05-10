import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * POST /api/auth/google/callback
 *
 * Receives the Google ID-token credential that GIS posts here after the
 * user selects their account (redirect UX mode).  We exchange it for a
 * Supabase session, stamp the session cookies onto the response, then
 * redirect the user to /auth/google/complete so the client can finalise
 * user-type metadata and route them to the right page.
 */
export async function POST(req: NextRequest) {
  const url    = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;

  /* ── 1. Parse the credential Google POSTed ─────────────────────────── */
  let credential: string | null = null;
  try {
    const formData = await req.formData();
    credential = formData.get("credential") as string | null;
  } catch {
    return NextResponse.redirect(`${origin}/login?error=bad_request`);
  }

  if (!credential) {
    return NextResponse.redirect(`${origin}/login?error=missing_credential`);
  }

  /* ── 2. Build the redirect response first so cookies can be set on it ─ */
  const response = NextResponse.redirect(`${origin}/auth/google/complete`);

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              options as Parameters<typeof response.cookies.set>[2]
            );
          });
        },
      },
    }
  );

  /* ── 3. Exchange Google ID token for a Supabase session ─────────────── */
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
  });

  if (error) {
    console.error("[google/callback] signInWithIdToken error:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
