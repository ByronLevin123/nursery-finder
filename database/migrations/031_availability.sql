-- 031: Nursery availability / waitlist feature
-- Lets providers publish open spots by age group so parents can see which nurseries have space.

CREATE TABLE IF NOT EXISTS nursery_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL,
  age_group TEXT NOT NULL,  -- 'Under 2', '2-3 years', '3-4 years', '4+ years'
  spots_available INTEGER NOT NULL DEFAULT 0,
  waitlist_length INTEGER DEFAULT 0,
  next_available_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nursery_urn, age_group)
);

CREATE INDEX IF NOT EXISTS idx_availability_urn ON nursery_availability (nursery_urn);

-- Denormalised columns on nurseries for search-result badges (avoids extra joins)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS spots_available INTEGER;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS has_waitlist BOOLEAN DEFAULT false;
