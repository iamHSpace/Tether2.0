import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/revalidate
 * Body: { username: string }
 *
 * Busts the ISR + fetch cache for a creator's public profile page
 * so theme / profile changes are immediately visible after saving.
 * Called from the settings page after api.profile.update().
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { username?: string };
    const username = body.username?.trim();

    if (!username) {
      return NextResponse.json({ error: "username required" }, { status: 400 });
    }

    // Revalidate the dynamic [handle] route — clears both the Full Route
    // Cache and the Data Cache (fetch cache) for this path.
    revalidatePath(`/@${username}`);

    return NextResponse.json({ revalidated: true, path: `/@${username}` });
  } catch {
    return NextResponse.json({ error: "revalidation failed" }, { status: 500 });
  }
}
