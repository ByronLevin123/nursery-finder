-- 017_travel_time.sql
-- Travel-time cache + work_postcode column on user_profiles

CREATE TABLE IF NOT EXISTS travel_time_cache (
  key TEXT PRIMARY KEY,
  from_lat DOUBLE PRECISION NOT NULL,
  from_lng DOUBLE PRECISION NOT NULL,
  to_lat DOUBLE PRECISION NOT NULL,
  to_lng DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL,
  duration_s INT NOT NULL,
  distance_m INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS travel_time_cache_created_at_idx
  ON travel_time_cache (created_at);

-- Cache is service-key only (no RLS policies) — RLS off by default.

ALTER TABLE IF EXISTS user_profiles
  ADD COLUMN IF NOT EXISTS work_postcode TEXT;
