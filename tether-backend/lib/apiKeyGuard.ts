import crypto from "crypto";
import { supabase as adminClient } from "@/lib/supabase";

export class ApiKeyError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Validates a Tether API key from the Authorization header.
 *
 * Expects: Authorization: Bearer tth_<hex>
 * Returns the user_id on success; throws ApiKeyError on failure.
 */
export async function requireApiKey(authHeader: string | null): Promise<string> {
  const raw = extractBearer(authHeader);
  if (!raw || !raw.startsWith("tth_")) {
    throw new ApiKeyError(401, "Missing or invalid API key. Expected Authorization: Bearer tth_<key>");
  }

  const hash = hashKey(raw);

  const { data, error } = await adminClient
    .from("api_keys")
    .select("id, user_id, is_active, expires_at")
    .eq("key_hash", hash)
    .single();

  if (error || !data) throw new ApiKeyError(401, "Invalid API key");
  if (!data.is_active) throw new ApiKeyError(403, "API key has been revoked");
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new ApiKeyError(403, "API key has expired");
  }

  // Fire-and-forget last_used_at update
  adminClient
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) console.error("[apiKeyGuard] last_used_at update failed:", e.message);
    });

  return data.user_id as string;
}

export function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateKey(): { raw: string; hash: string; prefix: string } {
  const bytes = crypto.randomBytes(32).toString("hex"); // 64 hex chars
  const raw = `tth_${bytes}`;
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 12) };
}

function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && token ? token : null;
}
