-- platform_tokens
-- Stores encrypted OAuth tokens for each platform a creator connects.
-- Linked directly to Supabase auth.users so RLS can enforce per-user access.

CREATE TABLE IF NOT EXISTS platform_tokens (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform        TEXT        NOT NULL,                  -- 'youtube' | 'instagram' | …
  access_token    TEXT        NOT NULL,                  -- AES-256-GCM encrypted
  refresh_token   TEXT,                                  -- AES-256-GCM encrypted
  token_expiry    TIMESTAMPTZ,                           -- when access_token expires
  scope           TEXT,                                  -- granted OAuth scopes
  platform_user_id   TEXT,                              -- e.g. YouTube channel ID
  platform_username  TEXT,                              -- e.g. YouTube channel name
  metadata        JSONB       DEFAULT '{}'::jsonb,       -- platform-specific extras
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT platform_tokens_user_platform_unique UNIQUE (user_id, platform)
);

-- Keep updated_at current automatically
CREATE OR REPLACE FUNCTION update_platform_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_tokens_updated_at
  BEFORE UPDATE ON platform_tokens
  FOR EACH ROW EXECUTE FUNCTION update_platform_tokens_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- The backend always uses the service-role key (bypasses RLS) to read/write
-- tokens server-side. RLS governs what any client (anon or authenticated) can
-- access when calling the PostgREST API directly.
--
-- SELECT is intentionally public because:
--   • The public profile page (/[username]) reads platform_username & metadata
--     to show which platforms a creator has connected — no secrets are exposed.
--   • access_token and refresh_token are AES-256-GCM encrypted server-side;
--     even if a client reads these columns the values are useless ciphertext.
-- Write operations are strictly user-scoped (users can only modify their own).
ALTER TABLE platform_tokens ENABLE ROW LEVEL SECURITY;

-- Anyone can read platform connection info (powers public creator profiles)
CREATE POLICY "Platform info is publicly viewable"
  ON platform_tokens FOR SELECT
  USING (true);

-- Only the owner may insert / update / delete their own tokens
CREATE POLICY "Users can insert their own tokens"
  ON platform_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
  ON platform_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON platform_tokens FOR DELETE
  USING (auth.uid() = user_id);
