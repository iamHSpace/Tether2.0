import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, AdminError } from "@/lib/adminGuard";
import { supabase as adminClient } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req.headers.get("Authorization"));

    const page  = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, parseInt(req.nextUrl.searchParams.get("limit") ?? "25", 10));
    const offset = (page - 1) * limit;

    const { data: convos, count, error } = await adminClient
      .from("conversations")
      .select("id, creator_id, business_id, last_message_at, created_at", { count: "exact" })
      .order("last_message_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const participantIds = [
      ...new Set([
        ...(convos ?? []).map(c => c.creator_id),
        ...(convos ?? []).map(c => c.business_id),
      ]),
    ];

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, username, full_name, company_name, user_type")
      .in("id", participantIds.length ? participantIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]));

    // Fetch last message for each conversation
    const convoIds = (convos ?? []).map(c => c.id);
    const { data: lastMsgs } = await adminClient
      .from("messages")
      .select("conversation_id, body, sender_id, created_at")
      .in("conversation_id", convoIds.length ? convoIds : ["00000000-0000-0000-0000-000000000000"])
      .order("created_at", { ascending: false });

    const lastMsgMap = new Map<string, typeof lastMsgs extends (infer T)[] | null ? T : never>();
    for (const m of lastMsgs ?? []) {
      if (!lastMsgMap.has(m.conversation_id)) lastMsgMap.set(m.conversation_id, m);
    }

    const enriched = (convos ?? []).map(c => {
      const creator  = profileMap.get(c.creator_id);
      const business = profileMap.get(c.business_id);
      const last = lastMsgMap.get(c.id);
      return {
        id:             c.id,
        last_message_at: c.last_message_at,
        created_at:     c.created_at,
        creator:  { id: c.creator_id,  username: creator?.username,  name: creator?.full_name  ?? creator?.username  ?? "?" },
        business: { id: c.business_id, username: business?.username, name: business?.company_name ?? business?.full_name ?? business?.username ?? "?" },
        last_message:   last ? { body: last.body.slice(0, 80), created_at: last.created_at } : null,
      };
    });

    return NextResponse.json({ conversations: enriched, total: count ?? 0, page, limit });
  } catch (err) {
    if (err instanceof AdminError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/conversations]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }
