import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client suitable for Server Components, Route Handlers,
 * and Server Actions.
 *
 * - getAll  → reads the current request cookies (including the auth token)
 * - setAll  → writes updated cookies back to the response (required for
 *             token refresh to persist beyond the current request)
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll is called from a Server Component where cookies() is
            // read-only.  The middleware handles the actual write in that case,
            // so this catch is intentional and safe to ignore.
          }
        },
      },
    }
  );
}
