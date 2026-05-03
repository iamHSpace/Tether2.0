-- Enable extensions required for scheduled HTTP calls from the database.
-- pg_cron  — runs SQL on a cron schedule inside Postgres
-- pg_net   — lets Postgres make outbound HTTP requests

CREATE EXTENSION IF NOT EXISTS pg_cron  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net   WITH SCHEMA extensions;

-- Schedule the daily-snapshot edge function at 00:05 UTC every day.
-- The 5-minute offset avoids the exact midnight spike on shared infrastructure.
--
-- The Authorization header carries CRON_SECRET so the edge function can
-- reject requests that didn't originate from this cron job.
--
-- NOTE: Replace the placeholder URL and secret before deploying to production.
--   URL format:  https://<project-ref>.supabase.co/functions/v1/daily-snapshot
--   Secret:      must match the CRON_SECRET set in the edge function secrets.
--
-- For local development the function can be invoked manually:
--   supabase functions invoke daily-snapshot --env-file supabase/.env.local

SELECT cron.schedule(
  'daily-youtube-snapshot',           -- job name (unique)
  '5 0 * * *',                        -- 00:05 UTC every day
  $$
  SELECT extensions.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/daily-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.cron_secret')
    ),
    body    := '{}'::jsonb
  );
  $$
);
