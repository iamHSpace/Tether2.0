import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Start with a plain pass-through response; we will replace it if cookies need to be written.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First, write the cookies onto the *request* object so the current
          // handler can read back the refreshed token.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          // Rebuild the response so it carries the same request mutations.
          supabaseResponse = NextResponse.next({ request });

          // Then stamp the same cookies onto the *response* so the browser
          // receives the updated tokens.
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT add any logic between createServerClient and getUser().
  // getUser() is what actually refreshes the session — the cookie writes above
  // happen as a side-effect of this call.
  //
  // Also use getUser() (not getSession()) — getUser() validates the JWT against
  // the Supabase auth server, making it safe to trust in server-side code.
  //
  // Wrapped in try/catch: if Supabase is temporarily unreachable (e.g. the
  // local Docker instance isn't up yet) we let the request through rather than
  // crashing every page with a 500.
  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.error("[middleware] supabase.auth.getUser() failed:", err);
  }

  // IMPORTANT: Return supabaseResponse as-is. If you return a different
  // NextResponse object the browser will lose the refreshed auth cookies.
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     *  - _next/static  (bundled assets)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - any file with an image extension
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
