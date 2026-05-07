import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

const ALLOWED_FIELDS = ["user_type", "is_suspended", "is_admin"] as const;
type AllowedField = (typeof ALLOWED_FIELDS)[number];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req.headers.get("Authorization"));
    const { id } = await params;

    // Prevent admin from removing their own admin status
    if (id === admin.id) {
      const body = await req.json() as Record<string, unknown>;
      if ("is_admin" in body && !body.is_admin) {
        return NextResponse.json({ error: "Cannot remove your own admin status" }, { status: 400 });
      }
    }

    const raw = await req.json() as Record<string, unknown>;
    const update: Record<AllowedField, unknown> = {} as Record<AllowedField, unknown>;
    for (const key of ALLOWED_FIELDS) {
      if (key in raw) update[key] = raw[key];
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update(update)
      .eq("id", id)
      .select("id, username, user_type, is_admin, is_suspended")
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user: data });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/users/[id] PUT]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req.headers.get("Authorization"));
    const { id } = await params;

    if (id === admin.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
    }

    // Hard-delete via Supabase auth admin API (cascades to profiles via FK)
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/users/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
