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

  async function raw(url: string) {
    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    return { status: res.status, body };
  }

  const until = Math.floor(Date.now() / 1000);
  const since = until - 30 * 24 * 3600;

  const [me, activity, reach30d, reachDefault, audienceFull, audienceCore, stories] =
    await Promise.all([
      raw(`${base}/me?fields=id,username,name,followers_count,media_count&access_token=${accessToken}`),
      raw(`${base}/me/insights?metric=website_clicks,profile_views&period=day&access_token=${accessToken}`),
      raw(`${base}/me/insights?metric=reach,impressions&period=day&since=${since}&until=${until}&access_token=${accessToken}`),
      raw(`${base}/me/insights?metric=reach,impressions&period=day&access_token=${accessToken}`),
      raw(`${base}/me/insights?metric=audience_gender_age,audience_country,audience_city,online_followers&period=lifetime&access_token=${accessToken}`),
      raw(`${base}/me/insights?metric=audience_gender_age,audience_country&period=lifetime&access_token=${accessToken}`),
      raw(`${base}/me/stories?fields=id,media_url,timestamp&access_token=${accessToken}`),
    ]);

  return NextResponse.json({
    me,
    activity,
    reach_30d: reach30d,
    reach_default: reachDefault,
    audience_full: audienceFull,
    audience_core: audienceCore,
    stories,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
