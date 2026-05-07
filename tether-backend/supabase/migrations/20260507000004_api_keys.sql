-- API keys for external developer access to the Tether v1 API.
-- Raw key is shown once on creation (tth_ prefix + 32 random bytes as hex).
-- Only the SHA-256 hash is stored here; the raw key cannot be recovered.

CREATE TABLE api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  key_hash     TEXT        NOT NULL UNIQUE,
  key_prefix   TEXT        NOT NULL,   -- first 12 chars of raw key, for display
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX api_keys_user_id_idx  ON api_keys (user_id);
CREATE INDEX api_keys_key_hash_idx ON api_keys (key_hash);

-- Creators can read/delete their own keys; inserts are done server-side via service role.
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner can read own keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "owner can delete own keys"
  ON api_keys FOR DELETE
  USING (auth.uid() = user_id);
