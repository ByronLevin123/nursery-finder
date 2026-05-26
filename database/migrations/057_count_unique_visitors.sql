-- Count unique visitors (distinct ip_hash) for page_visit events since a given timestamp.
-- Used by GET /api/v1/admin/stats for the visitor dashboard cards.
CREATE OR REPLACE FUNCTION count_unique_visitors(since TIMESTAMPTZ)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT ip_hash)
  FROM user_activity_log
  WHERE event = 'page_visit'
    AND created_at >= since
    AND ip_hash IS NOT NULL;
$$;

-- Index to speed up the page_visit aggregation query
CREATE INDEX IF NOT EXISTS idx_activity_page_visit
  ON user_activity_log (created_at DESC)
  WHERE event = 'page_visit';
