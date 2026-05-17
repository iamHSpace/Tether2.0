import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";
import {
  getInstagramAccount,
  getInstagramMedia,
  getInstagramAccountInsights,
  getAccountInsights30d,
  getStoriesInsights,
} from "@/lib/instagram";
import { decrypt } from "@/lib/encryption";
import { platforms } from "@/lib/config";

/**
 * GET /api/instagram/stats
 *
 * Returns the authenticated user's Instagram account stats + recent posts.
 *
 * 1. Verify Statvora session
 * 2. Load encrypted token from platform_tokens
 * 3. Check token expiry (Instagram tokens last 60 days, no refresh)
 * 4. Fetch account info + recent media from Instagram Graph API
 * 5. Save snapshot and return JSON
 */
export async function GET(req: NextRequest) {
  // 1. Verify Bearer token
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Load token
  const { data: row, error: dbError } = await adminClient
    .from("platform_tokens")
    .select("*")
    .eq("user_id", user.id)
    .eq("platform", platforms.INSTAGRAM)
    .single();

  if (dbError || !row) {
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }

  // 3. Check expiry — Instagram tokens don't refresh, user must reconnect
  const expiry = row.token_expiry ? new Date(row.token_expiry) : null;
  if (expiry && expiry.getTime() < Date.now()) {
    await adminClient.from("platform_tokens").delete().eq("id", row.id);
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = decrypt(row.access_token);
  } catch {
    await adminClient.from("platform_tokens").delete().eq("id", row.id);
    return NextResponse.json({ error: "token_expired" }, { status: 401 });
  }

  const igUserId = (row.platform_user_id as string | undefined);
  if (!igUserId) {
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }

  // 4. Fetch all data in parallel — account must succeed; rest are best-effort
  try {
    const [
      accountResult,
      postsResult,
      accountInsightsResult,
      insights30dResult,
      storiesResult,
    ] = await Promise.allSettled([
      getInstagramAccount(accessToken),
      getInstagramMedia(accessToken, igUserId),
      getInstagramAccountInsights(accessToken),
      getAccountInsights30d(accessToken),
      getStoriesInsights(accessToken),
    ]);

    // Account is required — surface error if it failed
    if (accountResult.status === "rejected") throw accountResult.reason;
    const account = accountResult.value;

    const posts           = postsResult.status           === "fulfilled" ? postsResult.value  : [];
    const accountInsights = accountInsightsResult.status === "fulfilled" ? accountInsightsResult.value : {};
    const insights30d     = insights30dResult.status     === "fulfilled" ? insights30dResult.value     : {};
    const stories         = storiesResult.status         === "fulfilled" ? storiesResult.value         : [];

    // Merge 30-day time series into account insights object
    const mergedInsights = { ...accountInsights, ...insights30d };

    // Derive online_followers_by_hour and audience from the already-working
    // accountInsights (fetched via /me/insights — no extra API call needed)
    const onlineHours = accountInsights.online_followers ?? null;
    const audience = (accountInsights.audience_gender_age || accountInsights.audience_country)
      ? {
          gender_age: accountInsights.audience_gender_age,
          country:    accountInsights.audience_country,
        }
      : null;

    // 5. Persist snapshot — fire-and-forget
    adminClient
      .from("metric_snapshots")
      .insert({
        user_id:  user.id,
        platform: platforms.INSTAGRAM,
        data:     {
          account,
          posts,
          account_insights:         mergedInsights,
          online_followers_by_hour: onlineHours,
          audience,
          stories,
        },
      })
      .then(({ error }) => {
        if (error) console.error("[instagram/stats] snapshot insert failed:", error.message);
      });

    adminClient
      .from("profiles")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", user.id)
      .then(({ error }) => {
        if (error) console.error("[instagram/stats] last_active_at update failed:", error.message);
      });

    return NextResponse.json({
      username:                account.username,
      full_name:               account.name,
      profile_picture_url:     account.profile_picture_url ?? null,
      followers_count:         account.followers_count,
      media_count:             account.media_count,
      recent_posts:            posts,
      account_insights:        mergedInsights,
      online_followers_by_hour: onlineHours,
      audience,
      stories,
      token_expires_at:        row.token_expiry ?? null,
      connected_at:            row.created_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[instagram/stats] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
