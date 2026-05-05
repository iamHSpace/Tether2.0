CREATE TABLE IF NOT EXISTS profile_views (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS profile_views_creator_time ON profile_views (creator_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS profile_views_viewer_dedup ON profile_views (viewer_id, creator_id, viewed_at DESC);

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Creators can read their own view stats
CREATE POLICY "creators_read_own_views" ON profile_views
  FOR SELECT USING (
    creator_id = auth.uid()
  );

-- Any authenticated user can insert a view (backend uses service role, so this is belt-and-suspenders)
CREATE POLICY "authenticated_insert_views" ON profile_views
  FOR INSERT WITH CHECK (true);
