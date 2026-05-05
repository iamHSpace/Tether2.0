-- Index on platform_tokens(user_id) to speed up the join in GET /api/creators/[username].
CREATE INDEX IF NOT EXISTS platform_tokens_user_id_idx ON platform_tokens (user_id);
