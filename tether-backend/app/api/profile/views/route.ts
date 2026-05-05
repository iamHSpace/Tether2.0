import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now       = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(weekStart.getDate() - 7);

  const { data: rows } = await adminClient
    .from("profile_views")
    .select("viewed_at")
    .eq("creator_id", user.id)
    .gte("viewed_at", lastWeekStart.toISOString())
    .order("viewed_at", { ascending: true });

  const views = rows ?? [];

  const thisWeek  = views.filter(r => new Date(r.viewed_at) >= weekStart).length;
  const lastWeek  = views.filter(r => new Date(r.viewed_at) < weekStart).length;

  // Daily breakdown for the last 7 days
  const daily: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    daily.push({
      date:  dateStr,
      count: views.filter(r => r.viewed_at.slice(0, 10) === dateStr).length,
    });
  }

  // All-time total
  const { count: allTime } = await adminClient
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);

  return NextResponse.json({ this_week: thisWeek, last_week: lastWeek, all_time: allTime ?? 0, daily });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
