-- RPC: get_latest_snapshots_batch
-- Like get_latest_snapshots but accepts an array of user_ids.
-- Used by the business dashboard batch endpoint to fetch all saved creators'
-- snapshots in one round-trip.

CREATE OR REPLACE FUNCTION get_latest_snapshots_batch(p_user_ids UUID[])
RETURNS TABLE(user_id UUID, platform TEXT, data JSONB, captured_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (ms.user_id, ms.platform)
    ms.user_id,
    ms.platform,
    ms.data,
    ms.captured_at
  FROM metric_snapshots ms
  WHERE ms.user_id = ANY(p_user_ids)
  ORDER BY ms.user_id, ms.platform, ms.captured_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_snapshots_batch(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_snapshots_batch(UUID[]) TO service_role;
