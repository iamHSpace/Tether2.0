/**
 * GET /api/creators/discover-businesses
 *
 * Authenticated — creator role only in practice, but no hard enforcement
 * since middleware handles the redirect.
 * Returns business profiles for creators to browse and message.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as admin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q        = searchParams.get("q")        ?? "";
  const category = searchParams.get("category") ?? "";
  const limit    = Math.min(Number(searchParams.get("limit")  ?? "20"), 50);
  const offset   = Number(searchParams.get("offset") ?? "0");

  let query = admin
    .from("profiles")
    .select("id, username, full_name, company_name, bio, website, category, updated_at", { count: "exact" })
    .eq("user_type", "business");

  if (q) {
    query = query.or(
      `company_name.ilike.%${q}%,full_name.ilike.%${q}%,username.ilike.%${q}%,bio.ilike.%${q}%`
    );
  }
  if (category) {
    query = query.eq("category", category);
  }

  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ businesses: data ?? [], total: count ?? 0 });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
