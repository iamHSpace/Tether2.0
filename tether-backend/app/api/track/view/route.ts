/**
 * POST /api/track/view
 *
 * Records a page view for a creator's public profile (/c/:username).
 * Called from the browser (client-side useEffect in TrackView island).
 *
 * Data captured:
 *   - Viewer identity (creator / business / anonymous)
 *   - Geo: country, region, city, timezone  (via ip-api.com, best-effort)
 *   - Device: type, browser, OS, mobile flag
 *   - Request context: language, referrer URL/domain/type, user-agent
 *
 * Always returns 200 so tracking never disrupts page rendering.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

// ── Device / UA parsing ───────────────────────────────────────────────────────

type DeviceType = "mobile" | "tablet" | "desktop";

function parseDeviceInfo(ua: string): {
  isMobile: boolean;
  deviceType: DeviceType;
  browser: string;
  os: string;
} {
  const isTablet  = /iPad|Tablet|PlayBook/.test(ua);
  const isMobile  = !isTablet && /Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/.test(ua);
  const deviceType: DeviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  let browser = "unknown";
  if      (/Edg\//.test(ua))          browser = "Edge";
  else if (/OPR\/|Opera\//.test(ua))  browser = "Opera";
  else if (/Chrome\//.test(ua))       browser = "Chrome";
  else if (/Firefox\//.test(ua))      browser = "Firefox";
  else if (/Safari\//.test(ua))       browser = "Safari";
  else if (/MSIE|Trident\//.test(ua)) browser = "IE";

  let os = "unknown";
  if      (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone/.test(ua))     os = "iOS";
  else if (/iPad/.test(ua))       os = "iPadOS";
  else if (/Android/.test(ua))    os = "Android";
  else if (/CrOS/.test(ua))       os = "ChromeOS";
  else if (/Mac OS X/.test(ua))   os = "macOS";
  else if (/Linux/.test(ua))      os = "Linux";

  return { isMobile, deviceType, browser, os };
}

// ── Referrer classification ───────────────────────────────────────────────────

type ReferrerType = "direct" | "search" | "social" | "internal" | "other";

const SEARCH_HOSTS  = ["google.com", "bing.com", "yahoo.com", "duckduckgo.com", "baidu.com", "yandex.com", "ecosia.org"];
const SOCIAL_HOSTS  = ["instagram.com", "twitter.com", "x.com", "linkedin.com", "facebook.com", "tiktok.com", "youtube.com", "threads.net", "reddit.com", "pinterest.com", "snapchat.com", "whatsapp.com"];
const STATVORA_HOSTS = ["statvora.vercel.app", "statvora.io", "localhost"];

function classifyReferrer(referrer: string | null): ReferrerType {
  if (!referrer) return "direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (SEARCH_HOSTS.some(d => host === d || host.endsWith(`.${d}`)))  return "search";
    if (SOCIAL_HOSTS.some(d => host === d || host.endsWith(`.${d}`)))  return "social";
    if (STATVORA_HOSTS.some(d => host === d || host.startsWith(d)))    return "internal";
    return "other";
  } catch {
    return "other";
  }
}

// ── IP geolocation (ip-api.com — free tier, no key required) ─────────────────

const PRIVATE_IP_RE = /^(::1|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

async function geoFromIp(ip: string): Promise<{
  country: string | null; region: string | null; city: string | null; timezone: string | null;
} | null> {
  if (!ip || PRIVATE_IP_RE.test(ip)) return null;
  try {
    const res = await fetch(
      `https://ip-api.com/json/${ip}?fields=status,country,regionName,city,timezone`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return null;
    const d = await res.json() as { status: string; country?: string; regionName?: string; city?: string; timezone?: string };
    if (d.status !== "success") return null;
    return {
      country:  d.country    ?? null,
      region:   d.regionName ?? null,
      city:     d.city       ?? null,
      timezone: d.timezone   ?? null,
    };
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { username?: string };
    const { username } = body;
    if (!username || typeof username !== "string") return NextResponse.json({ ok: true });

    // Resolve creator profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, user_type")
      .eq("username", username.trim())
      .single();
    if (!profile) return NextResponse.json({ ok: true });

    // Identify viewer (optional; anonymous is fine)
    const user = await getUserFromBearer(req.headers.get("Authorization")).catch(() => null);
    let viewerId: string | null = null;
    let viewerType: "creator" | "business" | "anonymous" = "anonymous";

    if (user && user.id !== profile.id) {
      const { data: vp } = await adminClient
        .from("profiles")
        .select("id, user_type")
        .eq("id", user.id)
        .single();
      if (vp) {
        viewerId   = vp.id;
        viewerType = (vp.user_type as "creator" | "business") ?? "anonymous";
      }
    }

    // Parse request headers
    const ua       = req.headers.get("user-agent") ?? "";
    const language = (req.headers.get("accept-language") ?? "").split(",")[0]?.trim() || null;
    const referrer = req.headers.get("referer") ?? null;
    const ip       = (
      req.headers.get("cf-connecting-ip")    ??
      req.headers.get("x-real-ip")           ??
      (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim()
    ) || null;

    const { isMobile, deviceType, browser, os } = parseDeviceInfo(ua);

    const referrerType   = classifyReferrer(referrer);
    let   referrerDomain: string | null = null;
    if (referrer) { try { referrerDomain = new URL(referrer).hostname; } catch { /* ignore */ } }

    // Best-effort geo lookup (capped at 2.5 s — tracking never blocks the response)
    const geo = ip ? await geoFromIp(ip) : null;

    // ── Insert into page_views (rich analytics) ───────────────────────────────
    adminClient.from("page_views").insert({
      profile_id:      profile.id,
      viewer_id:       viewerId,
      viewer_type:     viewerType,
      country:         geo?.country  ?? null,
      region:          geo?.region   ?? null,
      city:            geo?.city     ?? null,
      timezone:        geo?.timezone ?? null,
      device_type:     deviceType,
      browser,
      os,
      is_mobile:       isMobile,
      language,
      referrer_url:    referrer ? referrer.slice(0, 500) : null,
      referrer_domain: referrerDomain,
      referrer_type:   referrerType,
      user_agent:      ua.slice(0, 300),
    }).then(({ error }) => {
      if (error) console.error("[track/view] page_views insert:", error.message);
    });

    // ── Also insert into legacy profile_views (dashboard view-count widgets) ──
    adminClient.from("profile_views").insert({
      creator_id: profile.id,
      viewer_id:  viewerId,
    }).then(({ error }) => {
      if (error) console.error("[track/view] profile_views insert:", error.message);
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[track/view] unexpected:", err);
    return NextResponse.json({ ok: true }); // always 200 so tracking never breaks the page
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
