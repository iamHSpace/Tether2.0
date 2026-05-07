import { NextResponse } from "next/server";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://127.0.0.1:3000";

/**
 * GET /api/docs
 *
 * Proxies the OpenAPI spec from the backend so Swagger UI on this
 * domain can fetch it from the same origin (avoids CORS issues).
 */
export async function GET() {
  try {
    const res = await fetch(`${BACKEND}/api/docs`, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch API spec" }, { status: 502 });
    }
    const spec = await res.json();
    return NextResponse.json(spec);
  } catch {
    return NextResponse.json({ error: "Backend unavailable" }, { status: 502 });
  }
}
