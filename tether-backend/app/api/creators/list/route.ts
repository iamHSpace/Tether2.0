/**
 * GET /api/creators/list
 *
 * Public endpoint — no auth required.
 * Returns all creator usernames that have a public profile set up.
 * Used by the creator frontend sitemap generator.
 */
import { NextResponse } from "next/server";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await adminClient
    .from("profiles")
    .select("username")
    .not("username", "is", null)
    .order("username");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const usernames = (data ?? []).map(r => r.username as string);

  return NextResponse.json(
    { usernames },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=300" } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
