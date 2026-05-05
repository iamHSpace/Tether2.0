import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  // Viewer must be authenticated (business user calling from their portal)
  const viewer = await getUserFromBearer(req.headers.get("Authorization"));
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Resolve creator_id from username
  const { data: creator } = await adminClient
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });

  // Don't count a creator viewing their own profile
  if (creator.id === viewer.id) return NextResponse.json({ counted: false });

  // Dedup: skip if same viewer already logged a view in the last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await adminClient
    .from("profile_views")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creator.id)
    .eq("viewer_id", viewer.id)
    .gte("viewed_at", oneHourAgo);

  if ((count ?? 0) > 0) return NextResponse.json({ counted: false });

  await adminClient.from("profile_views").insert({
    creator_id: creator.id,
    viewer_id:  viewer.id,
  });

  return NextResponse.json({ counted: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
