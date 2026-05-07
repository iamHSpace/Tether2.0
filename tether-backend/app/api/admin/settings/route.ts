import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * GET /api/admin/settings
 * Returns all platform settings (key-value pairs).
 *
 * PUT /api/admin/settings
 * Body: { key: string, value: string }
 * Upsert a single setting.
 */
export async function GET(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  const { data, error } = await adminClient
    .from("platform_settings")
    .select("key, value, updated_at")
    .order("key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data ?? [] });
}

export async function PUT(req: NextRequest) {
  try { await requireAdmin(req.headers.get("Authorization")); } catch (e: unknown) {
    const err = e as { status?: number; message: string };
    return NextResponse.json({ error: err.message }, { status: err.status ?? 403 });
  }

  let body: { key?: string; value?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("platform_settings")
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() }, { onConflict: "key" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ setting: data });
}
