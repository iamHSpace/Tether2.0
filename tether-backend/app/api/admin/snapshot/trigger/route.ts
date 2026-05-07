import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/daily-snapshot`;
    const cronSecret  = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }

    const res = await fetch(functionUrl, {
      method:  "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal:  AbortSignal.timeout(60000), // edge functions can take up to 60s
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: "Edge function error", detail: body }, { status: 502 });
    }

    return NextResponse.json(body);
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/snapshot/trigger]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
