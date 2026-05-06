-- Track when a creator last loaded their dashboard (used to skip inactive creators in the daily cron)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
