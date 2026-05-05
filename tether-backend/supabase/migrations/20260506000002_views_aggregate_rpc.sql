-- RPC: get_creator_view_stats
-- Replaces 9 JS .filter() passes + 2 serial DB queries in the profile/views route.
-- Returns this_week, last_week, all_time, and daily counts for the last 7 days,
-- all computed in Postgres in a single query.

CREATE OR REPLACE FUNCTION get_creator_view_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
    boundaries AS (
      SELECT
        date_trunc('week', now() AT TIME ZONE 'UTC') AS week_start,
        date_trunc('week', now() AT TIME ZONE 'UTC') - INTERVAL '7 days' AS last_week_start,
        (now() AT TIME ZONE 'UTC')::date - 6 AS series_start
    ),
    counts AS (
      SELECT
        COUNT(*) FILTER (
          WHERE viewed_at >= (SELECT week_start FROM boundaries)
        ) AS this_week,
        COUNT(*) FILTER (
          WHERE viewed_at >= (SELECT last_week_start FROM boundaries)
            AND viewed_at <  (SELECT week_start FROM boundaries)
        ) AS last_week,
        COUNT(*) AS all_time
      FROM profile_views
      WHERE creator_id = p_user_id
    ),
    daily AS (
      SELECT
        (d.day)::text AS date,
        COUNT(pv.id)  AS count
      FROM generate_series(
        (SELECT series_start FROM boundaries),
        (now() AT TIME ZONE 'UTC')::date,
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN profile_views pv
        ON pv.creator_id = p_user_id
        AND (pv.viewed_at AT TIME ZONE 'UTC')::date = d.day::date
      GROUP BY d.day
      ORDER BY d.day
    )
  SELECT json_build_object(
    'this_week',  (SELECT this_week  FROM counts),
    'last_week',  (SELECT last_week  FROM counts),
    'all_time',   (SELECT all_time   FROM counts),
    'daily',      (SELECT json_agg(json_build_object('date', date, 'count', count) ORDER BY date) FROM daily)
  );
$$;

-- Grant execute to authenticated and anon roles (route uses service role anyway,
-- but explicit grants prevent permission errors if the role changes).
GRANT EXECUTE ON FUNCTION get_creator_view_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_creator_view_stats(UUID) TO service_role;
