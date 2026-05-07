import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    // All creators with their YouTube token status
    const { data: creators, error: cErr } = await adminClient
      .from("profiles")
      .select("id, username, full_name, last_active_at")
      .eq("user_type", "creator")
      .order("last_active_at", { ascending: false });

    if (cErr) throw cErr;

    const creatorIds = (creators ?? []).map(c => c.id);

    // YouTube tokens for those creators
    const { data: tokens, error: tErr } = await adminClient
      .from("platform_tokens")
      .select("user_id, platform_username, token_expiry, updated_at")
      .eq("platform", "youtube")
      .in("user_id", creatorIds.length ? creatorIds : ["00000000-0000-0000-0000-000000000000"]);

    if (tErr) throw tErr;

    // Latest snapshots for those creators
    const { data: snapshots, error: sErr } = await adminClient
      .from("metric_snapshots")
      .select("user_id, captured_at")
      .eq("platform", "youtube")
      .in("user_id", creatorIds.length ? creatorIds : ["00000000-0000-0000-0000-000000000000"])
      .order("captured_at", { ascending: false });

    if (sErr) throw sErr;

    const tokenMap = new Map((tokens ?? []).map(t => [t.user_id, t]));
    const latestSnap = new Map<string, string>();
    for (const s of snapshots ?? []) {
      if (!latestSnap.has(s.user_id)) latestSnap.set(s.user_id, s.captured_at);
    }

    const now = Date.now();
    const rows = (creators ?? []).map(c => {
      const token = tokenMap.get(c.id);
      const expiry = token?.token_expiry ? new Date(token.token_expiry) : null;
      const daysUntilExpiry = expiry ? Math.ceil((expiry.getTime() - now) / 86400000) : null;
      const lastSnapshot = latestSnap.get(c.id) ?? null;
      const snapshotAgeDays = lastSnapshot ? Math.ceil((now - new Date(lastSnapshot).getTime()) / 86400000) : null;

      return {
        id:              c.id,
        username:        c.username,
        full_name:       c.full_name,
        last_active_at:  c.last_active_at,
        connected:       !!token,
        channel_name:    token?.platform_username ?? null,
        token_expiry:    token?.token_expiry ?? null,
        days_until_expiry: daysUntilExpiry,
        last_snapshot:   lastSnapshot,
        snapshot_age_days: snapshotAgeDays,
        status:          !token ? "disconnected"
          : (daysUntilExpiry !== null && daysUntilExpiry < 3) ? "expiring_soon"
          : (snapshotAgeDays !== null && snapshotAgeDays > 2) ? "stale"
          : "healthy",
      };
    });

    return NextResponse.json({ creators: rows, total: rows.length });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/platform-health]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
