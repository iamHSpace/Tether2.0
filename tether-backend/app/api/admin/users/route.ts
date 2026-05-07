import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    const { searchParams } = req.nextUrl;
    const q           = searchParams.get("q")?.trim() ?? "";
    const userType    = searchParams.get("user_type");       // 'creator' | 'business'
    const suspended   = searchParams.get("suspended");       // 'true' | 'false'
    const page        = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit       = Math.min(50, parseInt(searchParams.get("limit") ?? "25", 10));
    const offset      = (page - 1) * limit;

    let query = adminClient
      .from("profiles")
      .select("id, username, full_name, company_name, user_type, is_admin, is_suspended, last_active_at, created_at, updated_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (q)                   query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%,company_name.ilike.%${q}%`);
    if (userType)            query = query.eq("user_type", userType);
    if (suspended === "true") query = query.eq("is_suspended", true);
    if (suspended === "false") query = query.eq("is_suspended", false);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ users: data ?? [], total: count ?? 0, page, limit });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/users]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
