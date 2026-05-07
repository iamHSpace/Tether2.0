-- ============================================================
-- Subscriptions, feature gating, rate limits, platform settings
-- ============================================================

-- Admin-configurable key-value store
CREATE TABLE platform_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_settings (key, value) VALUES
  ('sales_email',      'sutharhimanshu98@gmail.com'),
  ('stripe_enabled',   'false');

-- Subscription plans (admin editable)
CREATE TABLE subscription_plans (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT        NOT NULL,          -- 'Starter' | 'Specialist' | 'Growth' | 'Enterprise'
  user_type        TEXT        NOT NULL CHECK (user_type IN ('creator', 'business')),
  billing_period   TEXT        NOT NULL CHECK (billing_period IN ('monthly', 'annual')),
  price_cents      INTEGER     NOT NULL DEFAULT 0,
  stripe_price_id  TEXT,                           -- null until admin wires Stripe
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  is_enterprise    BOOLEAN     NOT NULL DEFAULT FALSE,
  is_free          BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, user_type, billing_period)
);

-- Feature registry
CREATE TABLE feature_definitions (
  key         TEXT PRIMARY KEY,
  label       TEXT        NOT NULL,
  description TEXT,
  user_type   TEXT        NOT NULL CHECK (user_type IN ('creator', 'business', 'any')),
  category    TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0
);

-- Per-plan feature configuration (enabled + optional rate limit)
CREATE TABLE plan_features (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID    NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  feature_key TEXT    NOT NULL REFERENCES feature_definitions(key) ON DELETE CASCADE,
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit  INTEGER,                              -- null = unlimited
  rate_period TEXT    NOT NULL DEFAULT 'day' CHECK (rate_period IN ('hour', 'day', 'month')),
  UNIQUE (plan_id, feature_key)
);

-- One subscription row per user
CREATE TABLE user_subscriptions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id               UUID        NOT NULL REFERENCES subscription_plans(id),
  stripe_customer_id    TEXT,
  stripe_subscription_id TEXT,
  status                TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage counters (per user / feature / period window)
CREATE TABLE feature_usage (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key  TEXT        NOT NULL REFERENCES feature_definitions(key),
  period_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL DEFAULT 0,
  UNIQUE (user_id, feature_key, period_start)
);

CREATE INDEX feature_usage_user_period_idx ON feature_usage (user_id, feature_key, period_start);

-- Atomic usage increment; returns new count
CREATE OR REPLACE FUNCTION increment_feature_usage(
  p_user_id     UUID,
  p_feature_key TEXT,
  p_period_start TIMESTAMPTZ
) RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE v_count INTEGER;
BEGIN
  INSERT INTO feature_usage (user_id, feature_key, period_start, count)
  VALUES (p_user_id, p_feature_key, p_period_start, 1)
  ON CONFLICT (user_id, feature_key, period_start)
  DO UPDATE SET count = feature_usage.count + 1
  RETURNING count INTO v_count;
  RETURN v_count;
END;
$$;

-- ============================================================
-- Seed: feature definitions
-- ============================================================

INSERT INTO feature_definitions (key, label, description, user_type, category, sort_order) VALUES
  -- Creator features
  ('creator_youtube_connect',    'Connect YouTube',              'Link your YouTube channel via OAuth',                        'creator', 'social',     10),
  ('creator_instagram_connect',  'Connect Instagram',            'Link your Instagram account via OAuth',                      'creator', 'social',     20),
  ('creator_analytics_dashboard','Analytics Dashboard',          'View subscribers, views, video metrics',                     'creator', 'analytics',  30),
  ('creator_metric_visibility',  'Metric Visibility Toggles',    'Choose which metrics brands can see on your public profile', 'creator', 'analytics',  40),
  ('creator_profile_views',      'Profile View Stats',           'See who viewed your profile — this week, last week, daily',  'creator', 'analytics',  50),
  ('creator_public_profile',     'Public Profile Link',          'Shareable verified /c/:username profile',                    'creator', 'profile',    60),
  ('creator_edit_profile',       'Edit Profile',                 'Update username, bio, avatar, category, stage',              'creator', 'profile',    70),
  ('creator_browse_businesses',  'Browse Businesses',            'Search and filter business profiles',                        'creator', 'discovery',  80),
  ('creator_messaging',          'Messaging with Businesses',    'Real-time direct messages to/from businesses',               'creator', 'messaging',  90),
  ('creator_daily_snapshot',     'Automated Daily Snapshot',     'Metrics stored daily for historical analysis',               'creator', 'analytics', 100),
  -- Business features
  ('business_discover_creators', 'Discover Creators',            'Search/filter creators by name, category, stage, metrics',   'business', 'discovery',  10),
  ('business_save_creators',     'Save Creators',                'Bookmark creators to a personal saved list',                 'business', 'discovery',  20),
  ('business_saved_list',        'Saved Creator List',           'View saved creators with enriched live metrics',             'business', 'discovery',  30),
  ('business_view_profiles',     'View Creator Profiles',        'Access full public creator profiles',                        'business', 'discovery',  40),
  ('business_messaging',         'Messaging with Creators',      'Real-time direct messages to/from creators',                 'business', 'messaging',  50),
  ('business_edit_profile',      'Edit Business Profile',        'Update company name, bio, website, username',                'business', 'profile',    60),
  ('business_api_keys',          'API Key Management',           'Generate and revoke developer API keys (max 10)',            'business', 'api',        70),
  ('business_api_docs',          'API Documentation',            'Interactive Swagger UI developer documentation',             'business', 'api',        80),
  -- Developer (API) features
  ('api_search_creators',        'API: Search Creators',         'GET /api/v1/creators — search with filters',                 'business', 'api',        90),
  ('api_get_profile',            'API: Get Own Profile',         'GET /api/v1/me — retrieve business profile',                 'business', 'api',       100),
  ('api_saved_list',             'API: List Saved Creators',     'GET /api/v1/saved — list saved creators',                    'business', 'api',       110),
  ('api_update_profile',         'API: Update Profile',          'PATCH /api/v1/me — update business profile fields',          'business', 'api',       120),
  ('api_save_creator',           'API: Save Creator',            'POST /api/v1/saved — add creator to saved list',             'business', 'api',       130),
  ('api_unsave_creator',         'API: Unsave Creator',          'DELETE /api/v1/saved — remove creator from saved list',      'business', 'api',       140);

-- ============================================================
-- Seed: subscription plans
-- ============================================================

INSERT INTO subscription_plans (name, user_type, billing_period, price_cents, is_free, is_enterprise) VALUES
  -- Creator plans
  ('Starter',    'creator', 'monthly',  0,     TRUE,  FALSE),
  ('Starter',    'creator', 'annual',   0,     TRUE,  FALSE),
  ('Specialist', 'creator', 'monthly',  900,   FALSE, FALSE),
  ('Specialist', 'creator', 'annual',   9000,  FALSE, FALSE),
  ('Growth',     'creator', 'monthly',  1900,  FALSE, FALSE),
  ('Growth',     'creator', 'annual',   19000, FALSE, FALSE),
  ('Enterprise', 'creator', 'monthly',  0,     FALSE, TRUE),
  ('Enterprise', 'creator', 'annual',   0,     FALSE, TRUE),
  -- Business plans
  ('Starter',    'business', 'monthly', 0,     TRUE,  FALSE),
  ('Starter',    'business', 'annual',  0,     TRUE,  FALSE),
  ('Specialist', 'business', 'monthly', 4900,  FALSE, FALSE),
  ('Specialist', 'business', 'annual',  49000, FALSE, FALSE),
  ('Growth',     'business', 'monthly', 9900,  FALSE, FALSE),
  ('Growth',     'business', 'annual',  99000, FALSE, FALSE),
  ('Enterprise', 'business', 'monthly', 0,     FALSE, TRUE),
  ('Enterprise', 'business', 'annual',  0,     FALSE, TRUE);

-- ============================================================
-- Seed: plan_features (defaults — admin can override)
-- Using subqueries to stay ID-agnostic
-- ============================================================

-- Helper: creator plan IDs
DO $$
DECLARE
  c_starter_m    UUID := (SELECT id FROM subscription_plans WHERE name='Starter'    AND user_type='creator' AND billing_period='monthly');
  c_starter_a    UUID := (SELECT id FROM subscription_plans WHERE name='Starter'    AND user_type='creator' AND billing_period='annual');
  c_spec_m       UUID := (SELECT id FROM subscription_plans WHERE name='Specialist' AND user_type='creator' AND billing_period='monthly');
  c_spec_a       UUID := (SELECT id FROM subscription_plans WHERE name='Specialist' AND user_type='creator' AND billing_period='annual');
  c_growth_m     UUID := (SELECT id FROM subscription_plans WHERE name='Growth'     AND user_type='creator' AND billing_period='monthly');
  c_growth_a     UUID := (SELECT id FROM subscription_plans WHERE name='Growth'     AND user_type='creator' AND billing_period='annual');
  c_ent_m        UUID := (SELECT id FROM subscription_plans WHERE name='Enterprise' AND user_type='creator' AND billing_period='monthly');
  c_ent_a        UUID := (SELECT id FROM subscription_plans WHERE name='Enterprise' AND user_type='creator' AND billing_period='annual');

  b_starter_m    UUID := (SELECT id FROM subscription_plans WHERE name='Starter'    AND user_type='business' AND billing_period='monthly');
  b_starter_a    UUID := (SELECT id FROM subscription_plans WHERE name='Starter'    AND user_type='business' AND billing_period='annual');
  b_spec_m       UUID := (SELECT id FROM subscription_plans WHERE name='Specialist' AND user_type='business' AND billing_period='monthly');
  b_spec_a       UUID := (SELECT id FROM subscription_plans WHERE name='Specialist' AND user_type='business' AND billing_period='annual');
  b_growth_m     UUID := (SELECT id FROM subscription_plans WHERE name='Growth'     AND user_type='business' AND billing_period='monthly');
  b_growth_a     UUID := (SELECT id FROM subscription_plans WHERE name='Growth'     AND user_type='business' AND billing_period='annual');
  b_ent_m        UUID := (SELECT id FROM subscription_plans WHERE name='Enterprise' AND user_type='business' AND billing_period='monthly');
  b_ent_a        UUID := (SELECT id FROM subscription_plans WHERE name='Enterprise' AND user_type='business' AND billing_period='annual');
BEGIN

  -- ---- CREATOR STARTER (free): core features only ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (c_starter_m, 'creator_youtube_connect',    TRUE,  NULL, 'day'),
    (c_starter_m, 'creator_instagram_connect',  FALSE, NULL, 'day'),
    (c_starter_m, 'creator_analytics_dashboard',TRUE,  NULL, 'day'),
    (c_starter_m, 'creator_metric_visibility',  FALSE, NULL, 'day'),
    (c_starter_m, 'creator_profile_views',      FALSE, NULL, 'day'),
    (c_starter_m, 'creator_public_profile',     TRUE,  NULL, 'day'),
    (c_starter_m, 'creator_edit_profile',       TRUE,  NULL, 'day'),
    (c_starter_m, 'creator_browse_businesses',  TRUE,  20,   'day'),
    (c_starter_m, 'creator_messaging',          FALSE, NULL, 'day'),
    (c_starter_m, 'creator_daily_snapshot',     FALSE, NULL, 'day');
  -- annual mirror
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT c_starter_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = c_starter_m;

  -- ---- CREATOR SPECIALIST ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (c_spec_m, 'creator_youtube_connect',    TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_instagram_connect',  TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_analytics_dashboard',TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_metric_visibility',  TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_profile_views',      TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_public_profile',     TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_edit_profile',       TRUE,  NULL, 'day'),
    (c_spec_m, 'creator_browse_businesses',  TRUE,  100,  'day'),
    (c_spec_m, 'creator_messaging',          TRUE,  50,   'day'),
    (c_spec_m, 'creator_daily_snapshot',     FALSE, NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT c_spec_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = c_spec_m;

  -- ---- CREATOR GROWTH ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (c_growth_m, 'creator_youtube_connect',    TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_instagram_connect',  TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_analytics_dashboard',TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_metric_visibility',  TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_profile_views',      TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_public_profile',     TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_edit_profile',       TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_browse_businesses',  TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_messaging',          TRUE,  NULL, 'day'),
    (c_growth_m, 'creator_daily_snapshot',     TRUE,  NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT c_growth_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = c_growth_m;

  -- ---- CREATOR ENTERPRISE (all unlimited) ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (c_ent_m, 'creator_youtube_connect',    TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_instagram_connect',  TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_analytics_dashboard',TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_metric_visibility',  TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_profile_views',      TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_public_profile',     TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_edit_profile',       TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_browse_businesses',  TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_messaging',          TRUE,  NULL, 'day'),
    (c_ent_m, 'creator_daily_snapshot',     TRUE,  NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT c_ent_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = c_ent_m;

  -- ---- BUSINESS STARTER (free) ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (b_starter_m, 'business_discover_creators', TRUE,  30,   'day'),
    (b_starter_m, 'business_save_creators',     TRUE,  5,    'day'),
    (b_starter_m, 'business_saved_list',        TRUE,  NULL, 'day'),
    (b_starter_m, 'business_view_profiles',     TRUE,  30,   'day'),
    (b_starter_m, 'business_messaging',         FALSE, NULL, 'day'),
    (b_starter_m, 'business_edit_profile',      TRUE,  NULL, 'day'),
    (b_starter_m, 'business_api_keys',          FALSE, NULL, 'day'),
    (b_starter_m, 'business_api_docs',          TRUE,  NULL, 'day'),
    (b_starter_m, 'api_search_creators',        FALSE, NULL, 'day'),
    (b_starter_m, 'api_get_profile',            FALSE, NULL, 'day'),
    (b_starter_m, 'api_saved_list',             FALSE, NULL, 'day'),
    (b_starter_m, 'api_update_profile',         FALSE, NULL, 'day'),
    (b_starter_m, 'api_save_creator',           FALSE, NULL, 'day'),
    (b_starter_m, 'api_unsave_creator',         FALSE, NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT b_starter_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = b_starter_m;

  -- ---- BUSINESS SPECIALIST ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (b_spec_m, 'business_discover_creators', TRUE,  500,  'day'),
    (b_spec_m, 'business_save_creators',     TRUE,  NULL, 'day'),
    (b_spec_m, 'business_saved_list',        TRUE,  NULL, 'day'),
    (b_spec_m, 'business_view_profiles',     TRUE,  NULL, 'day'),
    (b_spec_m, 'business_messaging',         TRUE,  50,   'day'),
    (b_spec_m, 'business_edit_profile',      TRUE,  NULL, 'day'),
    (b_spec_m, 'business_api_keys',          FALSE, NULL, 'day'),
    (b_spec_m, 'business_api_docs',          TRUE,  NULL, 'day'),
    (b_spec_m, 'api_search_creators',        FALSE, NULL, 'day'),
    (b_spec_m, 'api_get_profile',            FALSE, NULL, 'day'),
    (b_spec_m, 'api_saved_list',             FALSE, NULL, 'day'),
    (b_spec_m, 'api_update_profile',         FALSE, NULL, 'day'),
    (b_spec_m, 'api_save_creator',           FALSE, NULL, 'day'),
    (b_spec_m, 'api_unsave_creator',         FALSE, NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT b_spec_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = b_spec_m;

  -- ---- BUSINESS GROWTH ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (b_growth_m, 'business_discover_creators', TRUE,  NULL, 'day'),
    (b_growth_m, 'business_save_creators',     TRUE,  NULL, 'day'),
    (b_growth_m, 'business_saved_list',        TRUE,  NULL, 'day'),
    (b_growth_m, 'business_view_profiles',     TRUE,  NULL, 'day'),
    (b_growth_m, 'business_messaging',         TRUE,  NULL, 'day'),
    (b_growth_m, 'business_edit_profile',      TRUE,  NULL, 'day'),
    (b_growth_m, 'business_api_keys',          TRUE,  NULL, 'day'),
    (b_growth_m, 'business_api_docs',          TRUE,  NULL, 'day'),
    (b_growth_m, 'api_search_creators',        TRUE,  1000, 'day'),
    (b_growth_m, 'api_get_profile',            TRUE,  NULL, 'day'),
    (b_growth_m, 'api_saved_list',             TRUE,  NULL, 'day'),
    (b_growth_m, 'api_update_profile',         TRUE,  NULL, 'day'),
    (b_growth_m, 'api_save_creator',           TRUE,  NULL, 'day'),
    (b_growth_m, 'api_unsave_creator',         TRUE,  NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT b_growth_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = b_growth_m;

  -- ---- BUSINESS ENTERPRISE (all unlimited) ----
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period) VALUES
    (b_ent_m, 'business_discover_creators', TRUE,  NULL, 'day'),
    (b_ent_m, 'business_save_creators',     TRUE,  NULL, 'day'),
    (b_ent_m, 'business_saved_list',        TRUE,  NULL, 'day'),
    (b_ent_m, 'business_view_profiles',     TRUE,  NULL, 'day'),
    (b_ent_m, 'business_messaging',         TRUE,  NULL, 'day'),
    (b_ent_m, 'business_edit_profile',      TRUE,  NULL, 'day'),
    (b_ent_m, 'business_api_keys',          TRUE,  NULL, 'day'),
    (b_ent_m, 'business_api_docs',          TRUE,  NULL, 'day'),
    (b_ent_m, 'api_search_creators',        TRUE,  NULL, 'day'),
    (b_ent_m, 'api_get_profile',            TRUE,  NULL, 'day'),
    (b_ent_m, 'api_saved_list',             TRUE,  NULL, 'day'),
    (b_ent_m, 'api_update_profile',         TRUE,  NULL, 'day'),
    (b_ent_m, 'api_save_creator',           TRUE,  NULL, 'day'),
    (b_ent_m, 'api_unsave_creator',         TRUE,  NULL, 'day');
  INSERT INTO plan_features (plan_id, feature_key, is_enabled, rate_limit, rate_period)
    SELECT b_ent_a, feature_key, is_enabled, rate_limit, rate_period FROM plan_features WHERE plan_id = b_ent_m;

END $$;

-- RLS
ALTER TABLE platform_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_definitions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_features        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage        ENABLE ROW LEVEL SECURITY;

-- Public read for pricing page (no auth needed)
CREATE POLICY "public read plans"    ON subscription_plans   FOR SELECT USING (true);
CREATE POLICY "public read features" ON feature_definitions  FOR SELECT USING (true);
CREATE POLICY "public read plan_features" ON plan_features   FOR SELECT USING (true);
CREATE POLICY "public read settings" ON platform_settings    FOR SELECT USING (true);

-- Users read own subscription
CREATE POLICY "own subscription"  ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own usage"         ON feature_usage      FOR SELECT USING (auth.uid() = user_id);

-- All writes via service role only (backend bypasses RLS)
