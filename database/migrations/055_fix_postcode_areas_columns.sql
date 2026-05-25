-- Migration 055: Fix postcode_areas schema after data loss rebuild.
-- The combined migration was missing PropertyData columns (from 008) and
-- the family_score type change (from 009), causing calculate_all_family_scores()
-- to fail with "column does not exist".

-- 1. Add PropertyData columns (migration 008) — idempotent
ALTER TABLE postcode_areas
  ADD COLUMN IF NOT EXISTS asking_price_avg INTEGER,
  ADD COLUMN IF NOT EXISTS rent_avg_weekly INTEGER,
  ADD COLUMN IF NOT EXISTS gross_yield_pct DECIMAL(4,2),
  ADD COLUMN IF NOT EXISTS demand_rating TEXT,
  ADD COLUMN IF NOT EXISTS days_on_market INTEGER,
  ADD COLUMN IF NOT EXISTS price_growth_1yr_pct DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS propertydata_sample_postcode TEXT,
  ADD COLUMN IF NOT EXISTS propertydata_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_postcode_areas_propertydata_updated_at
  ON postcode_areas (propertydata_updated_at NULLS FIRST);

-- 2. Fix family_score column type (migration 009 changed 0-10 to 0-100 scale)
ALTER TABLE postcode_areas
  DROP CONSTRAINT IF EXISTS postcode_areas_family_score_check;

ALTER TABLE postcode_areas
  ALTER COLUMN family_score TYPE DECIMAL(5,1);

ALTER TABLE postcode_areas
  ADD CONSTRAINT postcode_areas_family_score_check
  CHECK (family_score IS NULL OR (family_score BETWEEN 0 AND 100));
