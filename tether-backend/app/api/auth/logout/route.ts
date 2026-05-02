import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { routes } from "@/lib/config";

export async function POST() {
  const supabase = await createSupabaseServerClient();

  // Sign out — invalidates the session server-side and clears auth cookies
  // via the setAll handler in supabaseServer.ts.
  await supabase.auth.signOut();

  return NextResponse.redirect(routes.login, { status: 302 });
}
