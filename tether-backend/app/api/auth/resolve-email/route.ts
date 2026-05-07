import { NextRequest, NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";

const CORS = { "Access-Control-Allow-Origin": process.env.FRONTEND_URL ?? "*" };

/**
 * POST /api/auth/resolve-email
 * Body: { identifier: string }
 *
 * If identifier looks like an email, returns it directly.
 * Otherwise treats it as a username and looks up the associated email.
 * Returns { email } or { error }.
 *
 * Uses service-role to query auth.users — never exposes emails in bulk,
 * only resolves a specific username the caller already knows.
 */
export async function POST(req: NextRequest) {
  let body: { identifier?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS });
  }

  const identifier = body.identifier?.trim().toLowerCase();
  if (!identifier) {
    return NextResponse.json({ error: "identifier is required" }, { status: 400, headers: CORS });
  }

  // If it contains @, treat as email — return immediately
  if (identifier.includes("@")) {
    return NextResponse.json({ email: identifier }, { headers: CORS });
  }

  // Look up username in profiles
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", identifier)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "No account found with that username" }, { status: 404, headers: CORS });
  }

  // Fetch email from auth.users via admin API
  const { data: { user }, error } = await adminClient.auth.admin.getUserById(profile.id);

  if (error || !user?.email) {
    return NextResponse.json({ error: "Could not resolve account email" }, { status: 404, headers: CORS });
  }

  return NextResponse.json({ email: user.email }, { headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
