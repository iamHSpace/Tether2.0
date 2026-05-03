CREATE TABLE public.metric_snapshots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform    TEXT        NOT NULL,
  data        JSONB       NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX metric_snapshots_user_platform_idx
  ON public.metric_snapshots (user_id, platform, captured_at DESC);

ALTER TABLE public.metric_snapshots ENABLE ROW LEVEL SECURITY;

-- Users can only read their own snapshots
CREATE POLICY "owner can read snapshots"
  ON public.metric_snapshots FOR SELECT
  USING (auth.uid() = user_id);

-- Inserts go through the service-role key (server-side only), so no
-- client-facing insert policy is needed.
