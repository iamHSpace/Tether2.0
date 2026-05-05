-- Enable pg_trgm for fast ILIKE '%query%' searches on creator profiles.
-- Without this, the discover search does a full table scan for every query.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS profiles_username_trgm
  ON profiles USING GIN (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS profiles_full_name_trgm
  ON profiles USING GIN (full_name gin_trgm_ops);
