import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as admin } from "@/lib/supabase";

/**
 * GET /api/conversations/[id]/messages
 * Returns messages in the conversation (newest 100) and marks incoming as read.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: conv } = await admin
    .from("conversations")
    .select("id, creator_id, business_id")
    .eq("id", id)
    .single();

  if (!conv || (conv.creator_id !== user.id && conv.business_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: messages, error } = await admin
    .from("messages")
    .select("id, sender_id, body, read_at, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark unread messages from the other participant as read
  const unreadIds = (messages ?? [])
    .filter(m => m.sender_id !== user.id && !m.read_at)
    .map(m => m.id);

  if (unreadIds.length > 0) {
    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  return NextResponse.json({ messages: messages ?? [] });
}

/**
 * POST /api/conversations/[id]/messages
 * Sends a message in the conversation.
 * Body: { body: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: conv } = await admin
    .from("conversations")
    .select("id, creator_id, business_id")
    .eq("id", id)
    .single();

  if (!conv || (conv.creator_id !== user.id && conv.business_id !== user.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: { body?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const text = body.body?.trim() ?? "";
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Message must be 1–2000 characters" }, { status: 400 });
  }

  const { data: message, error: msgError } = await admin
    .from("messages")
    .insert({ conversation_id: id, sender_id: user.id, body: text })
    .select()
    .single();

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Bump conversation timestamp for sort order
  await admin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ message });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
