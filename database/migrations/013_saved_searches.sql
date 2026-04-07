-- 013_saved_searches.sql — extend saved_searches with criteria + digest tracking
-- The base table was created in 002_user_accounts.sql; this migration adds the
-- columns required by the daily digest cron and the new saved-search UI.

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- The original table required postcode NOT NULL; the new UI may save searches
-- that are area-priority based and have no single postcode. Relax it.
ALTER TABLE saved_searches ALTER COLUMN postcode DROP NOT NULL;

CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_last_notified_idx ON saved_searches (last_notified_at);

-- RLS already enabled by 002; reaffirm policy exists for SELECT/INSERT/UPDATE/DELETE.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'saved_searches' AND policyname = 'Users manage own searches'
  ) THEN
    CREATE POLICY "Users manage own searches" ON saved_searches
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END$$;
