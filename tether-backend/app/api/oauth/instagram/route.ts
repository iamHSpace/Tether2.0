import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { getAuthUrl, createSignedState } from "@/lib/instagram";

/**
 * POST /api/oauth/instagram
 *
 * Initiates the Instagram (Facebook Graph API) OAuth flow.
 * Returns the Facebook consent-screen URL as JSON.
 * The frontend navigates to it.
 *
 * Requires: Authorization: Bearer <token>
 * Returns:  { url: string }
 */
export async function POST(req: NextRequest) {
  if (!process.env.INSTAGRAM_CLIENT_ID || !process.env.INSTAGRAM_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Instagram OAuth is not configured. Set INSTAGRAM_CLIENT_ID and INSTAGRAM_CLIENT_SECRET." },
      { status: 503 }
    );
  }

  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = createSignedState(user.id);
  const url   = getAuthUrl(state);

  return NextResponse.json({ url });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
