-- NurseryFinder — Initial Schema
-- Migration: 001
-- Created: Phase 1
-- Run in: Supabase SQL Editor (Project → SQL Editor → New query → paste → Run)
-- IMPORTANT: Never edit this file after running. Add changes as 002_, 003_ etc.

-- Section A: Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Section B: Nurseries table
CREATE TABLE IF NOT EXISTS nurseries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn                   TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  provider_type         TEXT,
  registration_status   TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  town                  TEXT,
  postcode              TEXT,
  local_authority       TEXT,
  region                TEXT,
  phone                 TEXT,
  email                 TEXT,
  website               TEXT,
  ofsted_overall_grade        TEXT,
  last_inspection_date        DATE,
  inspection_report_url       TEXT,
  enforcement_notice          BOOLEAN DEFAULT FALSE,
  places_funded_2yr           INTEGER,
  places_funded_3_4yr         INTEGER,
  total_places                INTEGER,
  google_place_id             TEXT,
  google_rating               DECIMAL(2,1),
  google_review_count         INTEGER,
  opening_hours               JSONB,
  fee_avg_monthly             INTEGER,
  fee_report_count            INTEGER DEFAULT 0,
  lat                         DECIMAL(10,7),
  lng                         DECIMAL(10,7),
  location                    GEOMETRY(Point, 4326) GENERATED ALWAYS AS (
    CASE
      WHEN lat IS NOT NULL AND lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(lng::float, lat::float), 4326)
      ELSE NULL
    END
  ) STORED,
  inspection_date_warning     BOOLEAN DEFAULT FALSE,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Section C: Indexes on nurseries
CREATE INDEX nurseries_location_gist_idx ON nurseries USING GIST(location);
CREATE INDEX nurseries_active_geocoded_idx ON nurseries(registration_status, local_authority) WHERE registration_status = 'Active' AND location IS NOT NULL;
CREATE INDEX nurseries_postcode_idx ON nurseries(postcode);
CREATE INDEX nurseries_grade_idx ON nurseries(ofsted_overall_grade);
CREATE INDEX nurseries_local_authority_idx ON nurseries(local_authority);
CREATE INDEX nurseries_urn_idx ON nurseries(urn);
CREATE INDEX nurseries_funded_2yr_idx ON nurseries(places_funded_2yr) WHERE places_funded_2yr > 0;
CREATE INDEX nurseries_funded_3yr_idx ON nurseries(places_funded_3_4yr) WHERE places_funded_3_4yr > 0;

-- Section D: Postcode areas table
CREATE TABLE IF NOT EXISTS postcode_areas (
  postcode_district         TEXT PRIMARY KEY,
  local_authority           TEXT,
  region                    TEXT,
  avg_sale_price_all        INTEGER,
  avg_sale_price_flat       INTEGER,
  avg_sale_price_terraced   INTEGER,
  avg_sale_price_semi       INTEGER,
  avg_sale_price_detached   INTEGER,
  price_change_1yr_pct      DECIMAL(5,2),
  crime_rate_per_1000       DECIMAL(8,2),
  crime_categories          JSONB,
  crime_last_updated        DATE,
  imd_decile                INTEGER CHECK (imd_decile BETWEEN 1 AND 10),
  imd_income_decile         INTEGER,
  imd_employment_decile     INTEGER,
  imd_education_decile      INTEGER,
  imd_crime_decile          INTEGER,
  imd_health_decile         INTEGER,
  flood_risk_level          TEXT CHECK (flood_risk_level IN ('Very Low','Low','Medium','High')),
  nursery_count_total       INTEGER DEFAULT 0,
  nursery_count_outstanding INTEGER DEFAULT 0,
  nursery_count_good        INTEGER DEFAULT 0,
  nursery_outstanding_pct   DECIMAL(5,2),
  family_score              DECIMAL(3,1) CHECK (family_score BETWEEN 0 AND 10),
  family_score_breakdown    JSONB,
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
CREATE INDEX postcode_areas_location_idx ON postcode_areas USING GIST(location);

-- Section E: User shortlist table
CREATE TABLE IF NOT EXISTS user_shortlists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,
  nursery_id    UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  notes         TEXT,
  visit_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nursery_id)
);

-- Section F: Fee submissions table
CREATE TABLE IF NOT EXISTS nursery_fees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id        UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  fee_per_month     INTEGER NOT NULL CHECK (fee_per_month > 0),
  hours_per_week    INTEGER CHECK (hours_per_week BETWEEN 1 AND 60),
  age_group         TEXT CHECK (age_group IN ('0-2', '2-3', '3-5', 'all')),
  submitted_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX nursery_fees_nursery_idx ON nursery_fees(nursery_id);

-- Section G: Nursery claims table
CREATE TABLE IF NOT EXISTS nursery_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id      UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  claimant_email  TEXT NOT NULL,
  verified        BOOLEAN DEFAULT FALSE,
  claimed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(nursery_id)
);

-- Section H: Review moderation queue
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

-- Section I-a: Inspection date warning trigger (non-immutable, so uses trigger instead of generated column)
CREATE OR REPLACE FUNCTION set_inspection_warning()
RETURNS TRIGGER AS $$
BEGIN
  NEW.inspection_date_warning := (
    NEW.last_inspection_date IS NOT NULL
    AND NEW.last_inspection_date < CURRENT_DATE - INTERVAL '4 years'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER nurseries_inspection_warning
  BEFORE INSERT OR UPDATE ON nurseries
  FOR EACH ROW EXECUTE FUNCTION set_inspection_warning();

-- Section I: Updated_at trigger
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

-- Section J: Core search function (two-stage PostGIS)
CREATE OR REPLACE FUNCTION search_nurseries_near(
  search_lat          FLOAT,
  search_lng          FLOAT,
  radius_km           FLOAT DEFAULT 5,
  grade_filter        TEXT DEFAULT NULL,
  funded_2yr          BOOLEAN DEFAULT FALSE,
  funded_3yr          BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID, urn TEXT, name TEXT, provider_type TEXT,
  address_line1 TEXT, town TEXT, postcode TEXT, local_authority TEXT,
  ofsted_overall_grade TEXT, last_inspection_date DATE,
  inspection_report_url TEXT, inspection_date_warning BOOLEAN,
  enforcement_notice BOOLEAN, total_places INTEGER,
  places_funded_2yr INTEGER, places_funded_3_4yr INTEGER,
  google_rating DECIMAL, google_review_count INTEGER,
  fee_avg_monthly INTEGER, fee_report_count INTEGER,
  lat DECIMAL, lng DECIMAL, distance_km FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    n.id, n.urn, n.name, n.provider_type,
    n.address_line1, n.town, n.postcode, n.local_authority,
    n.ofsted_overall_grade, n.last_inspection_date,
    n.inspection_report_url, n.inspection_date_warning,
    n.enforcement_notice, n.total_places,
    n.places_funded_2yr, n.places_funded_3_4yr,
    n.google_rating, n.google_review_count,
    n.fee_avg_monthly, n.fee_report_count,
    n.lat, n.lng,
    ST_Distance(
      n.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM nurseries n
  WHERE
    n.registration_status = 'Active'
    AND n.location IS NOT NULL
    AND n.location && ST_Expand(
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
      radius_km / 111.0
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

-- Section K: Area nursery stats aggregation function
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
