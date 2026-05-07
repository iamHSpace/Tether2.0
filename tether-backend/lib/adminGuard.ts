import { getUserFromBearer } from "@/lib/supabaseServer";
import { supabase as adminClient } from "@/lib/supabase";

export class AdminError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "AdminError";
  }
}

/**
 * Verifies the request has a valid Bearer token AND that the user has is_admin = true.
 * Throws AdminError(401) if unauthenticated, AdminError(403) if not admin.
 */
export async function requireAdmin(authHeader: string | null) {
  const user = await getUserFromBearer(authHeader);
  if (!user) throw new AdminError(401, "Unauthorized");

  const { data } = await adminClient
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!data?.is_admin) throw new AdminError(403, "Forbidden");
  return user;
}
