-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── profiles ─────────────────────────────────────────────────────────────────
-- One row per Supabase auth user.
-- Created during the onboarding wizard, updated from the settings page.
-- Public read access is intentional — creators share this page with brands.

CREATE TABLE public.profiles (
  -- Same UUID as auth.users.id so client code can do .eq("id", user.id)
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Unique handle used in the public profile URL: /<username>
  username        TEXT        UNIQUE,

  -- Display info
  full_name       TEXT,
  bio             TEXT,
  website         TEXT,
  avatar_url      TEXT,

  -- Onboarding answers (stored for personalisation / analytics)
  creator_stage   TEXT,    -- e.g. "just_starting" | "growing" | "established"
  aspiration      TEXT,    -- creator's stated goal
  platform_reason TEXT,    -- why they joined Tether

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep updated_at current
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Row Level Security — profiles ───────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated visitors) can read any profile.
-- This powers the public /[username] page.
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only write their own row.
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE
  USING (auth.uid() = id);
