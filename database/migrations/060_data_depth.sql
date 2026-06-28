-- Migration 060: Data depth tier 1
-- Adds registration date, data completeness, curriculum, SEN provision,
-- languages, meals, inspection history, and nursery-school proximity links.

-- Nursery registration date (from Ofsted CSV DateReg field)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS registered_date DATE;

-- Data completeness percentage (computed nightly)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS data_completeness_pct SMALLINT DEFAULT 0;

-- Curriculum types
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS curriculum_types TEXT[];

-- SEN provision
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS sen_provision BOOLEAN DEFAULT false;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS sen_specialisms TEXT[];
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS accessibility_features TEXT[];

-- Languages spoken by staff
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS languages TEXT[];

-- Meals and dietary
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS meals_provided BOOLEAN;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS meal_type TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS dietary_options TEXT[];

-- Inspection history table
CREATE TABLE IF NOT EXISTS nursery_inspections (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  urn TEXT NOT NULL,
  grade TEXT,
  quality_tier INTEGER,
  inspection_date DATE,
  report_url TEXT,
  inspection_body TEXT DEFAULT 'Ofsted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(urn, inspection_date)
);

CREATE INDEX IF NOT EXISTS idx_nursery_inspections_urn ON nursery_inspections (urn, inspection_date DESC);

-- Nursery-school proximity links (pre-computed)
CREATE TABLE IF NOT EXISTS nursery_school_links (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nursery_urn TEXT NOT NULL,
  school_urn TEXT NOT NULL,
  distance_km NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nursery_urn, school_urn)
);

CREATE INDEX IF NOT EXISTS idx_nursery_school_links_nursery ON nursery_school_links (nursery_urn);
CREATE INDEX IF NOT EXISTS idx_nursery_school_links_school ON nursery_school_links (school_urn);

-- Data completeness index
CREATE INDEX IF NOT EXISTS idx_nurseries_completeness ON nurseries (data_completeness_pct) WHERE registration_status = 'Active';
