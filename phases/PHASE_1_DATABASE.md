# Phase 1 — Database Schema

**Paste into Claude Code:** `Read phases/PHASE_1_DATABASE.md and execute it`

---

## What this phase does

Creates the complete PostgreSQL schema in Supabase including the PostGIS spatial
extension, all tables, indexes, stored functions, and triggers.
Creates the SQL file locally — Byron then pastes it into Supabase SQL Editor.

---

## Tasks

### 1.1 — Create database/migrations/001_initial_schema.sql

Write the complete SQL file with all sections below. Add a comment header:
```sql
-- NurseryFinder — Initial Schema
-- Migration: 001
-- Created: Phase 1
-- Run in: Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- IMPORTANT: Never edit this file after running. Add changes as 002_, 003_ etc.
```

#### Section A — Extensions
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### Section B — Nurseries table

```sql
CREATE TABLE IF NOT EXISTS nurseries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn                   TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  provider_type         TEXT,
  registration_status   TEXT,

  -- Address
  address_line1         TEXT,
  address_line2         TEXT,
  town                  TEXT,
  postcode              TEXT,
  local_authority       TEXT,
  region                TEXT,

  -- Contact
  phone                 TEXT,
  email                 TEXT,
  website               TEXT,

  -- Ofsted data
  ofsted_overall_grade        TEXT,
  last_inspection_date        DATE,
  inspection_report_url       TEXT,
  enforcement_notice          BOOLEAN DEFAULT FALSE,

  -- Capacity
  places_funded_2yr           INTEGER,
  places_funded_3_4yr         INTEGER,
  total_places                INTEGER,

  -- Enrichment (Google Places — added later)
  google_place_id             TEXT,
  google_rating               DECIMAL(2,1),
  google_review_count         INTEGER,
  opening_hours               JSONB,

  -- Fee data (crowd-sourced — Phase 6)
  fee_avg_monthly             INTEGER,
  fee_report_count            INTEGER DEFAULT 0,

  -- Geo — stored as raw coordinates AND generated geometry column
  lat                         DECIMAL(10,7),
  lng                         DECIMAL(10,7),
  location                    GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN lat IS NOT NULL AND lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(lng::float, lat::float), 4326)
      ELSE NULL
    END
  ) STORED,

  -- Computed flags (auto-maintained by trigger or generated)
  inspection_date_warning     BOOLEAN GENERATED ALWAYS AS (
    last_inspection_date IS NOT NULL
    AND last_inspection_date < CURRENT_DATE - INTERVAL '4 years'
  ) STORED,

  -- Metadata
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

#### Section C — Indexes on nurseries

```sql
-- Spatial index on generated geometry column (the correct PostGIS pattern)
CREATE INDEX nurseries_location_gist_idx
  ON nurseries USING GIST(location);

-- Partial index: active nurseries with location only (used in every search query)
CREATE INDEX nurseries_active_geocoded_idx
  ON nurseries(registration_status, local_authority)
  WHERE registration_status = 'Active' AND location IS NOT NULL;

-- Standard indexes
CREATE INDEX nurseries_postcode_idx         ON nurseries(postcode);
CREATE INDEX nurseries_grade_idx            ON nurseries(ofsted_overall_grade);
CREATE INDEX nurseries_local_authority_idx  ON nurseries(local_authority);
CREATE INDEX nurseries_urn_idx              ON nurseries(urn);
CREATE INDEX nurseries_funded_2yr_idx       ON nurseries(places_funded_2yr)
  WHERE places_funded_2yr > 0;
CREATE INDEX nurseries_funded_3yr_idx       ON nurseries(places_funded_3_4yr)
  WHERE places_funded_3_4yr > 0;
```

#### Section D — Postcode areas table

```sql
CREATE TABLE IF NOT EXISTS postcode_areas (
  postcode_district         TEXT PRIMARY KEY,
  local_authority           TEXT,
  region                    TEXT,

  -- Property (from Land Registry — Phase 8)
  avg_sale_price_all        INTEGER,
  avg_sale_price_flat       INTEGER,
  avg_sale_price_terraced   INTEGER,
  avg_sale_price_semi       INTEGER,
  avg_sale_price_detached   INTEGER,
  price_change_1yr_pct      DECIMAL(5,2),

  -- Safety (from Police API — Phase 8)
  crime_rate_per_1000       DECIMAL(8,2),
  crime_categories          JSONB,
  crime_last_updated        DATE,

  -- Deprivation (from ONS IMD — Phase 8)
  imd_decile                INTEGER CHECK (imd_decile BETWEEN 1 AND 10),
  imd_income_decile         INTEGER,
  imd_employment_decile     INTEGER,
  imd_education_decile      INTEGER,
  imd_crime_decile          INTEGER,
  imd_health_decile         INTEGER,

  -- Environment (from Environment Agency — Phase 8)
  flood_risk_level          TEXT CHECK (flood_risk_level IN ('Very Low','Low','Medium','High')),

  -- Nursery aggregates (computed from nurseries table)
  nursery_count_total       INTEGER DEFAULT 0,
  nursery_count_outstanding INTEGER DEFAULT 0,
  nursery_count_good        INTEGER DEFAULT 0,
  nursery_outstanding_pct   DECIMAL(5,2),

  -- Composite family score (Phase 8)
  family_score              DECIMAL(3,1) CHECK (family_score BETWEEN 0 AND 10),
  family_score_breakdown    JSONB,

  -- Centroid for API queries
  lat                       DECIMAL(10,7),
  lng                       DECIMAL(10,7),
  location                  GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN lat IS NOT NULL AND lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(lng::float, lat::float), 4326)
      ELSE NULL
    END
  ) STORED,

  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX postcode_areas_location_idx
  ON postcode_areas USING GIST(location);
```

#### Section E — User shortlist table (used in Phase 6 with auth)

```sql
CREATE TABLE IF NOT EXISTS user_shortlists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,           -- NULL for anonymous (localStorage only), filled when logged in
  nursery_id    UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  notes         TEXT,
  visit_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nursery_id)
);
```

#### Section F — Fee submissions table

```sql
CREATE TABLE IF NOT EXISTS nursery_fees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id        UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  fee_per_month     INTEGER NOT NULL CHECK (fee_per_month > 0),
  hours_per_week    INTEGER CHECK (hours_per_week BETWEEN 1 AND 60),
  age_group         TEXT CHECK (age_group IN ('0-2', '2-3', '3-5', 'all')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW()
  -- No user PII stored — anonymous submissions
);

CREATE INDEX nursery_fees_nursery_idx ON nursery_fees(nursery_id);
```

#### Section G — Nursery claims table (Phase 6)

```sql
CREATE TABLE IF NOT EXISTS nursery_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  claimant_email  TEXT NOT NULL,
  verified        BOOLEAN DEFAULT FALSE,
  claimed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nursery_id)
);
```

#### Section H — Review moderation queue (Phase 6)

```sql
CREATE TABLE IF NOT EXISTS nursery_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  user_id         UUID,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  moderation_status TEXT DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'disputed')),
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),
  published_at    TIMESTAMPTZ,
  UNIQUE(user_id, nursery_id)
);
```

#### Section I — Updated_at trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nurseries_updated_at
  BEFORE UPDATE ON nurseries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER postcode_areas_updated_at
  BEFORE UPDATE ON postcode_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

#### Section J — Core search function

```sql
CREATE OR REPLACE FUNCTION search_nurseries_near(
  search_lat          FLOAT,
  search_lng          FLOAT,
  radius_km           FLOAT DEFAULT 5,
  grade_filter        TEXT DEFAULT NULL,
  funded_2yr          BOOLEAN DEFAULT FALSE,
  funded_3yr          BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id                        UUID,
  urn                       TEXT,
  name                      TEXT,
  provider_type             TEXT,
  address_line1             TEXT,
  town                      TEXT,
  postcode                  TEXT,
  local_authority           TEXT,
  ofsted_overall_grade      TEXT,
  last_inspection_date      DATE,
  inspection_report_url     TEXT,
  inspection_date_warning   BOOLEAN,
  enforcement_notice        BOOLEAN,
  total_places              INTEGER,
  places_funded_2yr         INTEGER,
  places_funded_3_4yr       INTEGER,
  google_rating             DECIMAL,
  google_review_count       INTEGER,
  fee_avg_monthly           INTEGER,
  fee_report_count          INTEGER,
  lat                       DECIMAL,
  lng                       DECIMAL,
  distance_km               FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id,
    n.urn,
    n.name,
    n.provider_type,
    n.address_line1,
    n.town,
    n.postcode,
    n.local_authority,
    n.ofsted_overall_grade,
    n.last_inspection_date,
    n.inspection_report_url,
    n.inspection_date_warning,
    n.enforcement_notice,
    n.total_places,
    n.places_funded_2yr,
    n.places_funded_3_4yr,
    n.google_rating,
    n.google_review_count,
    n.fee_avg_monthly,
    n.fee_report_count,
    n.lat,
    n.lng,
    ST_Distance(
      n.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM nurseries n
  WHERE
    n.registration_status = 'Active'
    AND n.location IS NOT NULL
    -- Two-stage PostGIS pattern: bounding box first (fast), then exact distance
    AND n.location && ST_Expand(
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
      radius_km / 111.0  -- approximate degrees per km
    )
    AND ST_DWithin(
      n.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (grade_filter IS NULL OR n.ofsted_overall_grade = grade_filter)
    AND (NOT funded_2yr OR n.places_funded_2yr > 0)
    AND (NOT funded_3yr OR n.places_funded_3_4yr > 0)
  ORDER BY distance_km ASC
  LIMIT 100;
$$;
```

#### Section K — Area nursery stats aggregation function

```sql
CREATE OR REPLACE FUNCTION refresh_area_nursery_stats(district TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_total     INTEGER;
  v_outstanding INTEGER;
  v_good      INTEGER;
  v_pct       DECIMAL(5,2);
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Outstanding'),
    COUNT(*) FILTER (WHERE ofsted_overall_grade IN ('Outstanding', 'Good'))
  INTO v_total, v_outstanding, v_good
  FROM nurseries
  WHERE
    registration_status = 'Active'
    AND LEFT(postcode, LENGTH(district)) = district;

  v_pct := CASE WHEN v_total > 0
    THEN ROUND((v_outstanding::DECIMAL / v_total) * 100, 2)
    ELSE 0 END;

  INSERT INTO postcode_areas (
    postcode_district,
    nursery_count_total,
    nursery_count_outstanding,
    nursery_count_good,
    nursery_outstanding_pct
  ) VALUES (district, v_total, v_outstanding, v_good, v_pct)
  ON CONFLICT (postcode_district) DO UPDATE SET
    nursery_count_total       = EXCLUDED.nursery_count_total,
    nursery_count_outstanding = EXCLUDED.nursery_count_outstanding,
    nursery_count_good        = EXCLUDED.nursery_count_good,
    nursery_outstanding_pct   = EXCLUDED.nursery_outstanding_pct,
    updated_at                = NOW();
END;
$$;
```

### 1.2 — Create database/migrations/README.md

```markdown
# Database Migrations

## Rules

1. Never edit a migration file after it has been run in Supabase
2. New schema changes = new numbered file (002_add_fees.sql, etc.)
3. Each file must be self-contained and idempotent (use IF NOT EXISTS)
4. Run files in Supabase: Project → SQL Editor → New query → paste → Run

## Files

| File | Description | Status |
|------|-------------|--------|
| 001_initial_schema.sql | Core tables, indexes, functions | ⬜ Not run yet |

## How to run a migration

1. Open your Supabase project
2. Go to SQL Editor → New query
3. Paste the entire migration file
4. Click Run
5. Update status in this table to ✅
```

### 1.3 — Tell Byron what to do next

Print these exact instructions:

```
✅ Phase 1 complete! SQL file created at database/migrations/001_initial_schema.sql

Now run the migration in Supabase:

1. Go to your Supabase project (supabase.com)
2. Click "SQL Editor" in the left sidebar
3. Click "New query"
4. Open the file database/migrations/001_initial_schema.sql
5. Copy ALL the contents
6. Paste into the Supabase SQL Editor
7. Click "Run" (bottom right)
8. You should see: "Success. No rows returned"

If you see any errors, paste them back here and I'll fix them.

Once successful, come back and run Phase 2:
→ Type: Read phases/PHASE_2_COMPLIANCE.md and execute it
```
