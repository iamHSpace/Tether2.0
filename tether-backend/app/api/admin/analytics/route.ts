import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    const days = Math.min(90, parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10));
    const since = new Date(Date.now() - days * 86400000).toISOString();

    const { data: rows, error } = await adminClient
      .from("page_views")
      .select("viewer_type, country, device_type, referrer_type, viewed_at")
      .gte("viewed_at", since);

    if (error) throw error;

    const all = rows ?? [];
    const total = all.length;

    // Viewer type breakdown
    const viewerTypeCounts: Record<string, number> = {};
    // Country counts
    const countryCounts: Record<string, number> = {};
    // Device type breakdown
    const deviceCounts: Record<string, number> = {};
    // Referrer type breakdown
    const referrerCounts: Record<string, number> = {};
    // Daily views (keyed by YYYY-MM-DD)
    const dailyCounts: Record<string, number> = {};

    for (const row of all) {
      const vt = row.viewer_type ?? "anonymous";
      viewerTypeCounts[vt] = (viewerTypeCounts[vt] ?? 0) + 1;

      const c = row.country ?? "Unknown";
      countryCounts[c] = (countryCounts[c] ?? 0) + 1;

      const d = row.device_type ?? "unknown";
      deviceCounts[d] = (deviceCounts[d] ?? 0) + 1;

      const r = row.referrer_type ?? "direct";
      referrerCounts[r] = (referrerCounts[r] ?? 0) + 1;

      const day = row.viewed_at.slice(0, 10); // YYYY-MM-DD
      dailyCounts[day] = (dailyCounts[day] ?? 0) + 1;
    }

    // Top 10 countries
    const topCountries = Object.entries(countryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([country, count]) => ({ country, count }));

    // Daily array sorted ascending
    const dailyViews = Object.entries(dailyCounts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    return NextResponse.json({
      total,
      days,
      viewerType:  viewerTypeCounts,
      topCountries,
      deviceType:  deviceCounts,
      referrerType: referrerCounts,
      dailyViews,
    });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/analytics]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
