import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(req.headers.get("Authorization"));
    const { id } = await params;

    const [{ data: convo, error: cErr }, { data: messages, error: mErr }] = await Promise.all([
      adminClient
        .from("conversations")
        .select("id, creator_id, business_id, last_message_at, created_at")
        .eq("id", id)
        .single(),
      adminClient
        .from("messages")
        .select("id, sender_id, body, read_at, created_at")
        .eq("conversation_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (cErr || !convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (mErr) throw mErr;

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, username, full_name, company_name, user_type")
      .in("id", [convo.creator_id, convo.business_id]);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));
    const creator  = profileMap.get(convo.creator_id);
    const business = profileMap.get(convo.business_id);

    return NextResponse.json({
      conversation: {
        id:             convo.id,
        last_message_at: convo.last_message_at,
        created_at:     convo.created_at,
        creator:  { id: convo.creator_id,  name: creator?.full_name  ?? creator?.username  ?? "?", username: creator?.username },
        business: { id: convo.business_id, name: business?.company_name ?? business?.full_name ?? business?.username ?? "?", username: business?.username },
      },
      messages: messages ?? [],
    });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/conversations/[id]]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
