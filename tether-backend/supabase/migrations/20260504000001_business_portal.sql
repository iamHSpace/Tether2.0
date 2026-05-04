-- Migration: Business portal support
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- 1. Add user_type to profiles (creator | business)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'creator'
  CHECK (user_type IN ('creator', 'business'));

-- 2. Saved creators list — business users bookmark creator profiles
CREATE TABLE IF NOT EXISTS saved_creators (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  business_user_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  creator_username  TEXT        NOT NULL,
  saved_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate saves
CREATE UNIQUE INDEX IF NOT EXISTS saved_creators_unique
  ON saved_creators (business_user_id, creator_username);

-- Index for listing saved creators by business user
CREATE INDEX IF NOT EXISTS saved_creators_by_user
  ON saved_creators (business_user_id, saved_at DESC);

-- RLS: authenticated users can only see/modify their own saved list
ALTER TABLE saved_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business users manage their own saved list"
  ON saved_creators FOR ALL
  USING (auth.uid() = business_user_id)
  WITH CHECK (auth.uid() = business_user_id);
