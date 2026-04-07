-- Migration 014: Free data overlays — flood risk, parks/greenspace, schools
-- NOTE: postcode_areas.flood_risk_level already exists from migration 001 with a CHECK
-- constraint allowing only ('Very Low','Low','Medium','High'). The floodRisk service
-- normalises EA Flood API output to those exact values.

ALTER TABLE postcode_areas
  ADD COLUMN IF NOT EXISTS flood_updated_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nearest_park_name       TEXT,
  ADD COLUMN IF NOT EXISTS nearest_park_distance_m INTEGER,
  ADD COLUMN IF NOT EXISTS park_count_within_1km   INTEGER,
  ADD COLUMN IF NOT EXISTS parks_updated_at        TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS schools (
  id                    BIGSERIAL PRIMARY KEY,
  urn                   INTEGER UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  phase                 TEXT,
  postcode              TEXT,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  ofsted_grade          TEXT,
  last_inspection_date  DATE,
  local_authority       TEXT,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schools_postcode ON schools(postcode);
CREATE INDEX IF NOT EXISTS idx_schools_phase    ON schools(phase);
CREATE INDEX IF NOT EXISTS idx_schools_latlng   ON schools(lat, lng);
