-- Add metric_visibility JSONB column to profiles.
-- Each key maps to a boolean: true = visible on public profile, false = hidden.
-- Defaults to all metrics visible.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS metric_visibility JSONB NOT NULL DEFAULT '{
    "subscribers": true,
    "total_views": true,
    "video_count": true,
    "avg_views": true,
    "view_chart": true,
    "recent_videos": true
  }'::jsonb;
