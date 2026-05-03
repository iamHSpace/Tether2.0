import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Origins allowed to make cross-origin requests to the backend API.
// Both localhost and 127.0.0.1 are listed because browsers treat them as
// different origins — the cookie domain and the CORS allow-origin must
// match the actual browser URL used to open the frontend.
const ALLOWED_ORIGINS = new Set([
  process.env.FRONTEND_URL ?? "http://127.0.0.1:3001",
  "http://127.0.0.1:3001",
  "http://localhost:3001",
]);

export async function middleware(request: NextRequest) {
  const origin = request.headers.get("origin") ?? "";

  // Handle CORS preflight before anything else
  if (request.method === "OPTIONS") {
    const preflightResponse = new NextResponse(null, { status: 204 });
    if (ALLOWED_ORIGINS.has(origin)) {
      preflightResponse.headers.set("Access-Control-Allow-Origin", origin);
      preflightResponse.headers.set("Vary", "Origin");
    }
    preflightResponse.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    preflightResponse.headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    preflightResponse.headers.set("Access-Control-Max-Age", "86400");
    return preflightResponse;
  }

  // Start with a plain pass-through response; we will replace it if cookies need to be written.
  let supabaseResponse = NextResponse.next({ request });

  // Stamp CORS headers on every API response
  if (ALLOWED_ORIGINS.has(origin)) {
    supabaseResponse.headers.set("Access-Control-Allow-Origin", origin);
    supabaseResponse.headers.set("Vary", "Origin");
  }

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

  // Re-apply CORS headers in case setAll() above replaced supabaseResponse
  // with a new NextResponse.next() that doesn't have them yet.
  if (ALLOWED_ORIGINS.has(origin)) {
    supabaseResponse.headers.set("Access-Control-Allow-Origin", origin);
    supabaseResponse.headers.set("Vary", "Origin");
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
