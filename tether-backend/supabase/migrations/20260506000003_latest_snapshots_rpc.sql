-- RPC: get_latest_snapshots
-- Fixes the correctness bug in GET /api/creators/[username]:
-- the current .limit(10) + in-memory dedup can miss a platform's latest snapshot
-- if a creator has many snapshots. DISTINCT ON guarantees the latest per platform.

CREATE OR REPLACE FUNCTION get_latest_snapshots(p_user_id UUID)
RETURNS TABLE(platform TEXT, data JSONB, captured_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (platform)
    platform,
    data,
    captured_at
  FROM metric_snapshots
  WHERE user_id = p_user_id
  ORDER BY platform, captured_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_snapshots(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_latest_snapshots(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_latest_snapshots(UUID) TO anon;
