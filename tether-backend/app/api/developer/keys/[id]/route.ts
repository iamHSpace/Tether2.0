import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

/**
 * DELETE /api/developer/keys/[id]
 *
 * Revokes an API key (sets is_active = false).
 * Users can only revoke their own keys.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data, error } = await adminClient
    .from("api_keys")
    .update({ is_active: false })
    .eq("id", id)
    .eq("user_id", user.id)  // ensures users can only revoke their own keys
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Key not found or already revoked" }, { status: 404 });
  }

  return NextResponse.json({ revoked: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
