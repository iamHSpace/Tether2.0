"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server action that initiates Google OAuth.
 *
 * By running on the server, the PKCE code verifier is stored via Set-Cookie
 * response headers — guaranteed to be present in the browser before the OAuth
 * redirect fires, and reliably included in the subsequent /auth/callback request.
 */
export async function signInWithGoogle() {
  const cookieStore = await cookies();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3001";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/api/auth/callback`,
      skipBrowserRedirect: true, // we get the URL back and redirect via next/navigation
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`);
  }

  redirect(data.url);
}
