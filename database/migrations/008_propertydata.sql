-- Migration 008: PropertyData.co.uk live market fields on postcode_areas
-- Adds asking price, rents, yield, demand, growth sampled per district
-- from a single full postcode (first active nursery in that district).

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
