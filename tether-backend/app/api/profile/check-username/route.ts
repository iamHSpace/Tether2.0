import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/profile/check-username?username=xxx
 *
 * Returns { available: true } if the username is free to claim.
 * Returns { available: false } if it is taken by another user.
 * Returns { available: true } if it is already owned by the requesting user.
 *
 * Rules enforced here match the DB constraint:
 *   - 3–30 characters
 *   - lowercase letters, digits, underscores, hyphens only
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = req.nextUrl.searchParams.get("username")?.toLowerCase().trim() ?? "";

  if (!username) {
    return NextResponse.json({ available: false, error: "Username is required" });
  }

  if (!/^[a-z0-9_-]{3,30}$/.test(username)) {
    return NextResponse.json({
      available: false,
      error: "3–30 characters. Letters, numbers, _ and - only.",
    });
  }

  const { data, error } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Not taken at all, or already owned by this user
  const available = !data || data.id === user.id;

  return NextResponse.json({ available });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
