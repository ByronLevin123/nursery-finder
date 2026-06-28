-- Migration 061: Inspection detail extraction + provider responsiveness
-- Tier 3 data depth — AI-powered Ofsted report PDF/HTML extraction

-- Detailed inspection data extracted via Claude from Ofsted reports
CREATE TABLE IF NOT EXISTS nursery_inspection_details (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  urn TEXT NOT NULL,
  inspection_date DATE,
  staff_qualifications TEXT,
  staff_ratios TEXT,
  curriculum_approach TEXT,
  safeguarding_notes TEXT,
  strengths TEXT[],
  areas_for_improvement TEXT[],
  parent_feedback_themes TEXT[],
  key_themes TEXT[],
  raw_extract TEXT,
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(urn, inspection_date)
);

CREATE INDEX IF NOT EXISTS idx_inspection_details_urn ON nursery_inspection_details (urn);

-- Provider responsiveness columns (computed nightly from enquiries)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS response_time_hours NUMERIC;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS response_rate_pct SMALLINT;
