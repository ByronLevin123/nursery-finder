-- User activity log — per-user event tracking for admin observability

CREATE TABLE IF NOT EXISTS user_activity_log (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event      TEXT NOT NULL,
  target_urn TEXT,
  metadata   JSONB DEFAULT '{}',
  ip_hash    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_event ON user_activity_log (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_log (created_at DESC);

-- RPC to increment view_count safely (was called but never created)
CREATE OR REPLACE FUNCTION increment_view_count(nursery_urn TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE nurseries SET view_count = COALESCE(view_count, 0) + 1 WHERE urn = nursery_urn;
END;
$$ LANGUAGE plpgsql;

-- RPC to increment compare_count
CREATE OR REPLACE FUNCTION increment_compare_count(nursery_urn TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE nurseries SET compare_count = COALESCE(compare_count, 0) + 1 WHERE urn = nursery_urn;
END;
$$ LANGUAGE plpgsql;
