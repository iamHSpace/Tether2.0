import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(req.headers.get("Authorization"));
    const { id } = await params;

    if (id === admin.id) {
      return NextResponse.json({ error: "Cannot suspend your own account" }, { status: 400 });
    }

    const { suspended } = await req.json() as { suspended?: boolean };
    if (typeof suspended !== "boolean") {
      return NextResponse.json({ error: "suspended (boolean) required" }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("profiles")
      .update({ is_suspended: suspended })
      .eq("id", id)
      .select("id, username, is_suspended")
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ profile: data });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/profiles/[id]/flag]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
