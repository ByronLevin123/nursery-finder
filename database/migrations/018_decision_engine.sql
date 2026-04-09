-- Quiz responses
CREATE TABLE IF NOT EXISTS user_quiz_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  child_dob       DATE,
  child_name      TEXT,
  urgency         TEXT CHECK (urgency IN ('asap','3_months','6_months','exploring')),
  commute_from    TEXT CHECK (commute_from IN ('home','work','both')),
  commute_postcode TEXT,
  budget_min      INTEGER,
  budget_max      INTEGER,
  priority_order  TEXT[] DEFAULT '{}',
  must_haves      TEXT[] DEFAULT '{}',
  min_grade       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_quiz_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own quiz" ON user_quiz_responses;
CREATE POLICY "Users see own quiz" ON user_quiz_responses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nursery dimension scores (recomputed nightly)
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS quality_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS cost_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS availability_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS staff_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS dimension_scores_updated_at TIMESTAMPTZ;

-- Nursery pricing (structured, by age group)
CREATE TABLE IF NOT EXISTS nursery_pricing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  age_group       TEXT NOT NULL CHECK (age_group IN ('0-1','1-2','2-3','3-4','4-5')),
  session_type    TEXT NOT NULL CHECK (session_type IN ('full_day','half_day_am','half_day_pm','flexible')),
  fee_per_month   NUMERIC(8,2),
  hours_per_week  NUMERIC(4,1),
  funded_hours_deducted BOOLEAN DEFAULT false,
  effective_monthly_cost NUMERIC(8,2),
  meals_included  BOOLEAN DEFAULT false,
  source          TEXT CHECK (source IN ('provider','parent','estimated')) DEFAULT 'parent',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_pricing_nursery ON nursery_pricing(nursery_id);

-- Nursery availability (provider-updated)
CREATE TABLE IF NOT EXISTS nursery_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  age_group       TEXT NOT NULL CHECK (age_group IN ('0-1','1-2','2-3','3-4','4-5')),
  total_capacity  INTEGER,
  current_enrolled INTEGER DEFAULT 0,
  waitlist_count  INTEGER DEFAULT 0,
  next_available  DATE,
  next_intake     DATE,
  updated_by      UUID REFERENCES auth.users(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_availability_nursery ON nursery_availability(nursery_id);

-- Nursery staff metrics
CREATE TABLE IF NOT EXISTS nursery_staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  total_staff     INTEGER,
  qualified_teachers INTEGER,
  level_3_plus    INTEGER,
  avg_tenure_months INTEGER,
  ratio_under_2   TEXT,
  ratio_2_to_3    TEXT,
  ratio_3_plus    TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enquiries (multi-nursery apply)
CREATE TABLE IF NOT EXISTS enquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name      TEXT,
  child_dob       DATE,
  preferred_start DATE,
  session_preference TEXT,
  message         TEXT,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent','opened','responded','visit_booked','place_offered','accepted','declined')),
  provider_notes  TEXT,
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ
);

ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own enquiries" ON enquiries;
CREATE POLICY "Users see own enquiries" ON enquiries
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users create enquiries" ON enquiries;
CREATE POLICY "Users create enquiries" ON enquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_enquiries_user ON enquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_nursery ON enquiries(nursery_id);

-- Review category scores
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS category_scores JSONB;
