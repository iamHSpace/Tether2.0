import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { getAuthUrl } from "@/lib/youtube";
import { routes } from "@/lib/config";

/**
 * GET /api/oauth/youtube
 *
 * Entry point for the YouTube connect flow. Verifies the user is logged into
 * Tether first, then redirects them to Google's consent screen.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${routes.login}?error=must_be_logged_in`);
  }

  return NextResponse.redirect(getAuthUrl());
}
