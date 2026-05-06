import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as admin } from "@/lib/supabase";

/**
 * GET /api/conversations
 * Returns all conversations for the current user, enriched with the other
 * participant's profile, last message preview, and unread count.
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: convs, error } = await admin
    .from("conversations")
    .select("id, creator_id, business_id, last_message_at, created_at")
    .or(`creator_id.eq.${user.id},business_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!convs || convs.length === 0) return NextResponse.json({ conversations: [] });

  const otherIds = convs.map(c =>
    c.creator_id === user.id ? c.business_id : c.creator_id
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, full_name, company_name, avatar_url, user_type")
    .in("id", otherIds);

  const profileMap = Object.fromEntries(
    (profiles ?? []).map(p => [p.id, p])
  );

  const convIds = convs.map(c => c.id);

  const [{ data: allMsgs }, { data: unreadMsgs }] = await Promise.all([
    admin
      .from("messages")
      .select("conversation_id, body, sender_id, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
    admin
      .from("messages")
      .select("conversation_id, id")
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null),
  ]);

  // First message per conversation (DESC order gives us latest first)
  const lastMsgMap: Record<string, { body: string; sender_id: string; created_at: string }> = {};
  for (const m of (allMsgs ?? [])) {
    if (!lastMsgMap[m.conversation_id]) {
      lastMsgMap[m.conversation_id] = { body: m.body, sender_id: m.sender_id, created_at: m.created_at };
    }
  }

  const unreadMap: Record<string, number> = {};
  for (const m of (unreadMsgs ?? [])) {
    unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] ?? 0) + 1;
  }

  const conversations = convs.map(c => {
    const otherId = c.creator_id === user.id ? c.business_id : c.creator_id;
    const other = profileMap[otherId];
    const displayName = other?.user_type === "business"
      ? (other.company_name ?? other.full_name ?? other.username ?? "Business")
      : (other?.full_name ?? other?.username ?? "Creator");

    return {
      id: c.id,
      other_user: {
        id: otherId,
        username: other?.username ?? null,
        display_name: displayName,
        avatar_url: other?.avatar_url ?? null,
        user_type: (other?.user_type ?? "creator") as "creator" | "business",
      },
      last_message: lastMsgMap[c.id] ?? null,
      unread_count: unreadMap[c.id] ?? 0,
      last_message_at: c.last_message_at,
      created_at: c.created_at,
    };
  });

  return NextResponse.json({ conversations });
}

/**
 * POST /api/conversations
 * Creates or returns an existing conversation with another user.
 * Body: { other_user_id: string }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { other_user_id?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const otherId = body.other_user_id;
  if (!otherId) return NextResponse.json({ error: "other_user_id required" }, { status: 400 });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, user_type")
    .in("id", [user.id, otherId]);

  const me = profiles?.find(p => p.id === user.id);
  const other = profiles?.find(p => p.id === otherId);

  if (!other) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const myType = me?.user_type ?? "creator";
  const otherType = other.user_type;

  let creatorId: string, businessId: string;
  if (myType === "creator" && otherType === "business") {
    creatorId = user.id; businessId = otherId;
  } else if (myType === "business" && otherType === "creator") {
    creatorId = otherId; businessId = user.id;
  } else {
    return NextResponse.json(
      { error: "Conversations must be between a creator and a business" },
      { status: 400 }
    );
  }

  const { data: conv, error } = await admin
    .from("conversations")
    .upsert({ creator_id: creatorId, business_id: businessId }, { onConflict: "creator_id,business_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: conv });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
