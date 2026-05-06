-- Rich page-view tracking table for creator public profiles (/c/:username)
-- Captures viewer identity (creator / business / anonymous), geo, device, and referrer data
-- for future per-user analytics dashboards.

CREATE TABLE IF NOT EXISTS page_views (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Who is viewing
  viewer_type      TEXT        NOT NULL DEFAULT 'anonymous',  -- 'creator' | 'business' | 'anonymous'

  -- Geo (derived from IP via ip-api.com)
  country          TEXT,
  region           TEXT,
  city             TEXT,
  timezone         TEXT,

  -- Device
  device_type      TEXT,        -- 'mobile' | 'desktop' | 'tablet'
  browser          TEXT,        -- 'Chrome' | 'Firefox' | 'Safari' | 'Edge' | 'Opera' | 'IE' | 'unknown'
  os               TEXT,        -- 'Windows' | 'macOS' | 'Android' | 'iOS' | 'iPadOS' | 'Linux' | 'ChromeOS' | 'unknown'
  is_mobile        BOOLEAN,

  -- Request context
  language         TEXT,        -- first tag from Accept-Language, e.g. 'en-US', 'fr'
  referrer_url     TEXT,        -- trimmed to 500 chars
  referrer_domain  TEXT,        -- hostname extracted from referrer
  referrer_type    TEXT,        -- 'direct' | 'search' | 'social' | 'internal' | 'other'
  user_agent       TEXT,        -- trimmed to 300 chars

  viewed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes optimised for per-creator analytics queries
CREATE INDEX page_views_profile_time_idx    ON page_views (profile_id, viewed_at DESC);
CREATE INDEX page_views_viewer_type_idx     ON page_views (profile_id, viewer_type, viewed_at DESC);
CREATE INDEX page_views_country_idx         ON page_views (profile_id, country, viewed_at DESC);
CREATE INDEX page_views_device_type_idx     ON page_views (profile_id, device_type, viewed_at DESC);
CREATE INDEX page_views_referrer_type_idx   ON page_views (profile_id, referrer_type, viewed_at DESC);
CREATE INDEX page_views_global_time_idx     ON page_views (viewed_at DESC);
CREATE INDEX page_views_viewer_id_idx       ON page_views (viewer_id) WHERE viewer_id IS NOT NULL;

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Creators can read analytics for their own profile
CREATE POLICY "creators_read_own_page_views" ON page_views
  FOR SELECT USING (profile_id = auth.uid());

-- Open insert so the backend service role (and any anon client) can record views
CREATE POLICY "anyone_insert_page_views" ON page_views
  FOR INSERT WITH CHECK (true);
