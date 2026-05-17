import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";
import { platforms } from "@/lib/config";
import { instagram as cfg } from "@/lib/config";

/**
 * GET /api/instagram/debug
 * Temporary endpoint — returns raw Instagram API responses for diagnostics.
 * DELETE this route once insights are confirmed working.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: row } = await adminClient
    .from("platform_tokens")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", platforms.INSTAGRAM)
    .single();

  if (!row) return NextResponse.json({ error: "not_connected" }, { status: 404 });

  let accessToken: string;
  try { accessToken = decrypt(row.access_token); }
  catch { return NextResponse.json({ error: "decrypt_failed" }, { status: 500 }); }

  const base = cfg.apiBase;
  const until = Math.floor(Date.now() / 1000);
  const since7d = until - 7 * 24 * 3600;
  const since30d = until - 30 * 24 * 3600;
  const at = `access_token=${accessToken}`;

  async function raw(label: string, url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    return { label, status: res.status, body };
  }

  const results = await Promise.all([
    raw("me",                  `${base}/me?fields=id,username,name,followers_count,media_count&${at}`),
    // Activity — no date range (default 7d)
    raw("activity_default",    `${base}/me/insights?metric=website_clicks,profile_views&period=day&${at}`),
    // Activity — with 7d date range
    raw("activity_7d",         `${base}/me/insights?metric=website_clicks,profile_views&period=day&since=${since7d}&until=${until}&${at}`),
    // Reach only — 30d date range
    raw("reach_30d",           `${base}/me/insights?metric=reach&period=day&since=${since30d}&until=${until}&${at}`),
    // Reach only — default (no date range)
    raw("reach_default",       `${base}/me/insights?metric=reach&period=day&${at}`),
    // Views (new metric — replaces impressions)
    raw("views_default",       `${base}/me/insights?metric=views&period=day&${at}`),
    // accounts_engaged
    raw("engaged_default",     `${base}/me/insights?metric=accounts_engaged&period=day&${at}`),
    // Follower demographics — age+gender breakdown
    raw("follower_demo_age",   `${base}/me/insights?metric=follower_demographics&period=lifetime&breakdown=age,gender&${at}`),
    // Follower demographics — country breakdown
    raw("follower_demo_country", `${base}/me/insights?metric=follower_demographics&period=lifetime&breakdown=country&${at}`),
    // Reached audience demographics
    raw("reached_demo_age",    `${base}/me/insights?metric=reached_audience_demographics&period=day&since=${since30d}&until=${until}&breakdown=age,gender&${at}`),
    // online_followers (still in valid list)
    raw("online_followers",    `${base}/me/insights?metric=online_followers&period=lifetime&${at}`),
    // Stories
    raw("stories",             `${base}/me/stories?fields=id,media_url,timestamp&${at}`),
  ]);

  return NextResponse.json(Object.fromEntries(results.map(r => [r.label, { status: r.status, body: r.body }])));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
