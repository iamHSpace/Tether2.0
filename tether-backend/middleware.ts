import { NextRequest, NextResponse } from "next/server";

// Always allow both localhost and 127.0.0.1 variants for local dev,
// plus the FRONTEND_URL env var and production domain.
const CORS_ORIGINS = new Set(
  [
    process.env.FRONTEND_URL,
    "https://statvora.in",
    // Local dev — allow both hostname forms so the browser never hits a CORS wall
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ].filter(Boolean) as string[]
);

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "";
  const allowed = CORS_ORIGINS.has(origin);

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowed ? origin : [...CORS_ORIGINS][0] ?? "",
        ...CORS_HEADERS,
      },
    });
  }

  const res = NextResponse.next();
  if (allowed) res.headers.set("Access-Control-Allow-Origin", origin);
  return res;
}

export const config = { matcher: "/api/:path*" };
