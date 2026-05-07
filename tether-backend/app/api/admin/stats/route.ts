import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    const now = new Date();
    const startOfToday  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek   = new Date(now.getTime() - 7  * 86400000).toISOString();
    const startOfMonth  = new Date(now.getTime() - 30 * 86400000).toISOString();
    const active30Days  = startOfMonth;

    const [
      { count: totalUsers },
      { count: totalCreators },
      { count: totalBusinesses },
      { count: activeCreators },
      { count: viewsToday },
      { count: viewsWeek },
      { count: viewsMonth },
      { count: totalConversations },
      { count: totalMessages },
    ] = await Promise.all([
      adminClient.from("profiles").select("*", { count: "exact", head: true }),
      adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "creator"),
      adminClient.from("profiles").select("*", { count: "exact", head: true }).eq("user_type", "business"),
      adminClient.from("profiles").select("*", { count: "exact", head: true })
        .eq("user_type", "creator").gte("last_active_at", active30Days),
      adminClient.from("page_views").select("*", { count: "exact", head: true }).gte("viewed_at", startOfToday),
      adminClient.from("page_views").select("*", { count: "exact", head: true }).gte("viewed_at", startOfWeek),
      adminClient.from("page_views").select("*", { count: "exact", head: true }).gte("viewed_at", startOfMonth),
      adminClient.from("conversations").select("*", { count: "exact", head: true }),
      adminClient.from("messages").select("*", { count: "exact", head: true }),
    ]);

    return NextResponse.json({
      users:         { total: totalUsers ?? 0, creators: totalCreators ?? 0, businesses: totalBusinesses ?? 0, activeCreators: activeCreators ?? 0 },
      pageViews:     { today: viewsToday ?? 0, week: viewsWeek ?? 0, month: viewsMonth ?? 0 },
      messaging:     { conversations: totalConversations ?? 0, messages: totalMessages ?? 0 },
    });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/stats]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
