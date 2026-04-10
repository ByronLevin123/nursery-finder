-- 026_saved_search_alerts.sql — Add last_alerted_at column and partial index
-- for the saved-search email alerts feature.

ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_saved_searches_alert_on_new
  ON saved_searches (last_alerted_at)
  WHERE alert_on_new = true;
