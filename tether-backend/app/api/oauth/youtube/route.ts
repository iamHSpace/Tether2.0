import { NextRequest, NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/supabaseServer";
import { getAuthUrl, createSignedState } from "@/lib/youtube";

/**
 * POST /api/oauth/youtube
 *
 * Decoupled entry-point for the YouTube connect flow.
 *
 * Accepts an Authorization: Bearer <token> header.
 * Creates a short-lived signed state that embeds the user's ID so the callback
 * can identify the user without relying on a session cookie.
 * Returns the Google consent-screen URL as JSON — the frontend performs the
 * redirect itself.
 *
 * Returns: { url: string }
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get("Authorization"));
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = createSignedState(user.id);
  const url   = getAuthUrl(state);

  return NextResponse.json({ url });
}

// Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
