-- ============================================================================
-- NurseryMatch — Combined Migration (001 through 054)
-- Safe to run on a FRESH Supabase project.
-- Paste into: Supabase Dashboard → SQL Editor → New query → Run
--
-- NOTE: This is ~2000 lines. Supabase SQL editor handles it fine.
-- If you get a timeout, split at the "-- SPLIT POINT" markers below.
-- ============================================================================

-- ============================================================
-- 001: Extensions + Core Tables
-- ============================================================
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

CREATE INDEX IF NOT EXISTS nurseries_location_gist_idx ON nurseries USING GIST(location);
CREATE INDEX IF NOT EXISTS nurseries_active_geocoded_idx ON nurseries(registration_status, local_authority) WHERE registration_status = 'Active' AND location IS NOT NULL;
CREATE INDEX IF NOT EXISTS nurseries_postcode_idx ON nurseries(postcode);
CREATE INDEX IF NOT EXISTS nurseries_grade_idx ON nurseries(ofsted_overall_grade);
CREATE INDEX IF NOT EXISTS nurseries_local_authority_idx ON nurseries(local_authority);
CREATE INDEX IF NOT EXISTS nurseries_urn_idx ON nurseries(urn);
CREATE INDEX IF NOT EXISTS nurseries_funded_2yr_idx ON nurseries(places_funded_2yr) WHERE places_funded_2yr > 0;
CREATE INDEX IF NOT EXISTS nurseries_funded_3yr_idx ON nurseries(places_funded_3_4yr) WHERE places_funded_3_4yr > 0;

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
CREATE INDEX IF NOT EXISTS postcode_areas_location_idx ON postcode_areas USING GIST(location);

CREATE TABLE IF NOT EXISTS user_shortlists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID,
  nursery_id    UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  notes         TEXT,
  visit_date    DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nursery_id)
);

-- Nursery claims (015 version — final schema)
CREATE TABLE IF NOT EXISTS nursery_claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn             TEXT NOT NULL,
  user_id         UUID NOT NULL,
  claimer_name    TEXT NOT NULL,
  claimer_role    TEXT,
  claimer_email   TEXT NOT NULL,
  claimer_phone   TEXT,
  evidence_notes  TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes     TEXT,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS nursery_claims_active_unique
  ON nursery_claims (urn, user_id) WHERE status <> 'rejected';
CREATE INDEX IF NOT EXISTS nursery_claims_status_idx ON nursery_claims (status);
CREATE INDEX IF NOT EXISTS nursery_claims_user_idx ON nursery_claims (user_id);

ALTER TABLE nursery_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own claims" ON nursery_claims
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own claims" ON nursery_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers: inspection warning + updated_at
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

DROP TRIGGER IF EXISTS nurseries_inspection_warning ON nurseries;
CREATE TRIGGER nurseries_inspection_warning
  BEFORE INSERT OR UPDATE ON nurseries
  FOR EACH ROW EXECUTE FUNCTION set_inspection_warning();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS nurseries_updated_at ON nurseries;
CREATE TRIGGER nurseries_updated_at
  BEFORE UPDATE ON nurseries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS postcode_areas_updated_at ON postcode_areas;
CREATE TRIGGER postcode_areas_updated_at
  BEFORE UPDATE ON postcode_areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Core search function
CREATE OR REPLACE FUNCTION search_nurseries_near(
  search_lat FLOAT, search_lng FLOAT,
  radius_km FLOAT DEFAULT 5,
  grade_filter TEXT DEFAULT NULL,
  funded_2yr BOOLEAN DEFAULT FALSE,
  funded_3yr BOOLEAN DEFAULT FALSE
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

CREATE OR REPLACE FUNCTION refresh_area_nursery_stats(district TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_total INTEGER; v_outstanding INTEGER; v_good INTEGER; v_pct DECIMAL(5,2);
BEGIN
  SELECT COUNT(*),
    COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Outstanding'),
    COUNT(*) FILTER (WHERE ofsted_overall_grade IN ('Outstanding', 'Good'))
  INTO v_total, v_outstanding, v_good
  FROM nurseries WHERE registration_status = 'Active' AND LEFT(postcode, LENGTH(district)) = district;
  v_pct := CASE WHEN v_total > 0 THEN ROUND((v_outstanding::DECIMAL / v_total) * 100, 2) ELSE 0 END;
  INSERT INTO postcode_areas (postcode_district, nursery_count_total, nursery_count_outstanding, nursery_count_good, nursery_outstanding_pct)
  VALUES (district, v_total, v_outstanding, v_good, v_pct)
  ON CONFLICT (postcode_district) DO UPDATE SET
    nursery_count_total = EXCLUDED.nursery_count_total,
    nursery_count_outstanding = EXCLUDED.nursery_count_outstanding,
    nursery_count_good = EXCLUDED.nursery_count_good,
    nursery_outstanding_pct = EXCLUDED.nursery_outstanding_pct,
    updated_at = NOW();
END;
$$;

-- ============================================================
-- 002: User accounts + RLS
-- ============================================================
ALTER TABLE user_shortlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own shortlist" ON user_shortlists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users add to own shortlist" ON user_shortlists FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  postcode TEXT,
  radius_km INTEGER DEFAULT 5,
  grade_filter TEXT,
  funded_2yr BOOLEAN DEFAULT FALSE,
  funded_3yr BOOLEAN DEFAULT FALSE,
  alert_on_new BOOLEAN DEFAULT FALSE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own searches" ON saved_searches FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- 003: Property layer
-- ============================================================
CREATE TABLE IF NOT EXISTS land_registry_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode TEXT NOT NULL,
  postcode_district TEXT NOT NULL,
  price INTEGER NOT NULL,
  date_of_transfer DATE NOT NULL,
  property_type TEXT CHECK (property_type IN ('D','S','T','F','O')),
  new_build BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS lr_district_date_idx ON land_registry_prices(postcode_district, date_of_transfer);
CREATE INDEX IF NOT EXISTS lr_district_type_idx ON land_registry_prices(postcode_district, property_type);

CREATE TABLE IF NOT EXISTS area_property_stats (
  postcode_district TEXT PRIMARY KEY,
  avg_price_all INTEGER, avg_price_flat INTEGER, avg_price_terraced INTEGER,
  avg_price_semi INTEGER, avg_price_detached INTEGER,
  median_price INTEGER, transactions_last_12m INTEGER,
  price_change_1yr_pct DECIMAL(5,2),
  last_calculated TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION calculate_family_score(district TEXT)
RETURNS DECIMAL(3,1) LANGUAGE plpgsql AS $$
DECLARE
  v_area postcode_areas%ROWTYPE;
  v_nursery_score DECIMAL; v_safety_score DECIMAL;
  v_deprivation_score DECIMAL; v_flood_score DECIMAL;
  v_final_score DECIMAL(3,1); v_breakdown JSONB;
BEGIN
  SELECT * INTO v_area FROM postcode_areas WHERE postcode_district = district;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_nursery_score := COALESCE(LEAST(10, (v_area.nursery_outstanding_pct / 100.0) * 10), 5);
  v_safety_score := CASE
    WHEN v_area.crime_rate_per_1000 IS NULL THEN 5
    WHEN v_area.crime_rate_per_1000 < 20 THEN 10 WHEN v_area.crime_rate_per_1000 < 40 THEN 8
    WHEN v_area.crime_rate_per_1000 < 60 THEN 6 WHEN v_area.crime_rate_per_1000 < 80 THEN 4 ELSE 2 END;
  v_deprivation_score := COALESCE(v_area.imd_decile, 5)::DECIMAL;
  v_flood_score := CASE v_area.flood_risk_level
    WHEN 'Very Low' THEN 10 WHEN 'Low' THEN 8 WHEN 'Medium' THEN 5 WHEN 'High' THEN 2 ELSE 7 END;
  v_final_score := ROUND(
    (v_nursery_score * 0.35) + (v_safety_score * 0.30) +
    (v_deprivation_score * 0.25) + (v_flood_score * 0.10), 1);
  v_breakdown := jsonb_build_object(
    'nursery', jsonb_build_object('score', v_nursery_score, 'weight', 0.35),
    'safety', jsonb_build_object('score', v_safety_score, 'weight', 0.30),
    'deprivation', jsonb_build_object('score', v_deprivation_score, 'weight', 0.25),
    'flood', jsonb_build_object('score', v_flood_score, 'weight', 0.10));
  UPDATE postcode_areas SET family_score = v_final_score, family_score_breakdown = v_breakdown, updated_at = NOW()
  WHERE postcode_district = district;
  RETURN v_final_score;
END;
$$;

-- ============================================================
-- 004: Area aggregation function
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_postcode_area_nursery_stats()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE rows_affected INTEGER;
BEGIN
  WITH district_stats AS (
    SELECT
      UPPER(SPLIT_PART(postcode, ' ', 1)) AS postcode_district,
      MAX(local_authority) AS local_authority, MAX(region) AS region,
      COUNT(*) AS nursery_count_total,
      COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Outstanding') AS nursery_count_outstanding,
      COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Good') AS nursery_count_good,
      AVG(lat)::DECIMAL(10,7) AS lat, AVG(lng)::DECIMAL(10,7) AS lng
    FROM nurseries WHERE registration_status = 'Active' AND postcode IS NOT NULL AND postcode <> ''
    GROUP BY 1
  )
  INSERT INTO postcode_areas (postcode_district, local_authority, region,
    nursery_count_total, nursery_count_outstanding, nursery_count_good,
    nursery_outstanding_pct, lat, lng, updated_at)
  SELECT postcode_district, local_authority, region,
    nursery_count_total, nursery_count_outstanding, nursery_count_good,
    CASE WHEN nursery_count_total > 0
      THEN ROUND((nursery_count_outstanding::DECIMAL / nursery_count_total) * 100, 2) ELSE 0 END,
    lat, lng, NOW()
  FROM district_stats
  ON CONFLICT (postcode_district) DO UPDATE SET
    local_authority = EXCLUDED.local_authority, region = EXCLUDED.region,
    nursery_count_total = EXCLUDED.nursery_count_total,
    nursery_count_outstanding = EXCLUDED.nursery_count_outstanding,
    nursery_count_good = EXCLUDED.nursery_count_good,
    nursery_outstanding_pct = EXCLUDED.nursery_outstanding_pct,
    lat = COALESCE(postcode_areas.lat, EXCLUDED.lat),
    lng = COALESCE(postcode_areas.lng, EXCLUDED.lng),
    updated_at = NOW();
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- ============================================================
-- 005: Land registry unique index
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS land_registry_prices_unique
  ON land_registry_prices (postcode, date_of_transfer, price, property_type);

-- ============================================================
-- 006: Property stats timeout function
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_area_property_stats(target_district TEXT DEFAULT NULL)
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE rows_affected INTEGER;
BEGIN
  WITH stats AS (
    SELECT postcode_district,
      ROUND(AVG(price))::INTEGER AS avg_price_all,
      ROUND(AVG(price) FILTER (WHERE property_type = 'F'))::INTEGER AS avg_price_flat,
      ROUND(AVG(price) FILTER (WHERE property_type = 'T'))::INTEGER AS avg_price_terraced,
      ROUND(AVG(price) FILTER (WHERE property_type = 'S'))::INTEGER AS avg_price_semi,
      ROUND(AVG(price) FILTER (WHERE property_type = 'D'))::INTEGER AS avg_price_detached,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)::INTEGER AS median_price,
      COUNT(*) FILTER (WHERE date_of_transfer > CURRENT_DATE - INTERVAL '12 months')::INTEGER AS transactions_last_12m
    FROM land_registry_prices
    WHERE (target_district IS NULL OR postcode_district = target_district)
    GROUP BY postcode_district
  )
  INSERT INTO area_property_stats (postcode_district, avg_price_all, avg_price_flat,
    avg_price_terraced, avg_price_semi, avg_price_detached, median_price, transactions_last_12m, last_calculated)
  SELECT postcode_district, avg_price_all, avg_price_flat, avg_price_terraced,
    avg_price_semi, avg_price_detached, median_price, transactions_last_12m, NOW()
  FROM stats
  ON CONFLICT (postcode_district) DO UPDATE SET
    avg_price_all = EXCLUDED.avg_price_all, avg_price_flat = EXCLUDED.avg_price_flat,
    avg_price_terraced = EXCLUDED.avg_price_terraced, avg_price_semi = EXCLUDED.avg_price_semi,
    avg_price_detached = EXCLUDED.avg_price_detached, median_price = EXCLUDED.median_price,
    transactions_last_12m = EXCLUDED.transactions_last_12m, last_calculated = NOW();
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- ============================================================
-- 007: Reviews (final schema — replaces 001's version)
-- ============================================================
DROP TABLE IF EXISTS nursery_reviews CASCADE;

CREATE TABLE nursery_reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn                 TEXT NOT NULL,
  rating              SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body                TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  would_recommend     BOOLEAN NOT NULL,
  child_age_months    SMALLINT CHECK (child_age_months BETWEEN 0 AND 72),
  attended_from       DATE,
  attended_to         DATE,
  author_display_name TEXT,
  ip_hash             TEXT,
  status              TEXT NOT NULL DEFAULT 'published'
                      CHECK (status IN ('published','pending','rejected','spam','flagged')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nursery_reviews_urn_status_created
  ON nursery_reviews (urn, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nursery_reviews_ip_hash_created
  ON nursery_reviews (ip_hash, created_at);

ALTER TABLE nurseries
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_avg_rating DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS review_recommend_pct DECIMAL(5,2);

CREATE OR REPLACE FUNCTION refresh_nursery_review_stats(target_urn TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF target_urn IS NOT NULL THEN
    UPDATE nurseries n SET review_count = COALESCE(s.cnt, 0),
        review_avg_rating = s.avg_rating, review_recommend_pct = s.recommend_pct
    FROM (SELECT COUNT(*)::INTEGER AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        ROUND((100.0 * SUM(CASE WHEN would_recommend THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric, 2) AS recommend_pct
      FROM nursery_reviews WHERE urn = target_urn AND status = 'published') s
    WHERE n.urn = target_urn;
  ELSE
    UPDATE nurseries n SET review_count = COALESCE(s.cnt, 0),
        review_avg_rating = s.avg_rating, review_recommend_pct = s.recommend_pct
    FROM (SELECT urn, COUNT(*)::INTEGER AS cnt, ROUND(AVG(rating)::numeric, 2) AS avg_rating,
        ROUND((100.0 * SUM(CASE WHEN would_recommend THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0))::numeric, 2) AS recommend_pct
      FROM nursery_reviews WHERE status = 'published' GROUP BY urn) s
    WHERE n.urn = s.urn;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION nursery_reviews_refresh_stats_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_nursery_review_stats(COALESCE(NEW.urn, OLD.urn));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS nursery_reviews_refresh_stats ON nursery_reviews;
CREATE TRIGGER nursery_reviews_refresh_stats
AFTER INSERT OR UPDATE OR DELETE ON nursery_reviews
FOR EACH ROW EXECUTE FUNCTION nursery_reviews_refresh_stats_trigger();

-- ============================================================
-- 008: PropertyData API key column
-- ============================================================
-- (handled by env vars, no schema changes needed)

-- ============================================================
-- 009: Family score improvements
-- ============================================================
-- (function already created in 003)

-- -- SPLIT POINT 1 -- paste everything above first if timeout --

-- ============================================================
-- 010: User profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  avatar_url    TEXT,
  home_postcode TEXT,
  children      JSONB DEFAULT '[]'::jsonb,
  preferences   JSONB,
  email_alerts  BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own profile" ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users insert own profile" ON user_profiles;
CREATE POLICY "Users insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 011: AI content cache
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ai_content_cache_key_idx ON ai_content_cache (cache_key);
CREATE INDEX IF NOT EXISTS ai_content_cache_expires_idx ON ai_content_cache (expires_at);

-- ============================================================
-- 012: Property listings
-- ============================================================
CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_district TEXT NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  external_id TEXT, address TEXT, postcode TEXT,
  price INTEGER, bedrooms INTEGER, bathrooms INTEGER,
  property_type TEXT, description TEXT, image_url TEXT,
  listing_url TEXT, agent_name TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  raw JSONB, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS property_listings_unique_external
  ON property_listings (postcode_district, listing_type, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS property_listings_district_type_idx ON property_listings (postcode_district, listing_type);
CREATE INDEX IF NOT EXISTS property_listings_price_idx ON property_listings (price);
CREATE INDEX IF NOT EXISTS property_listings_bedrooms_idx ON property_listings (bedrooms);
CREATE INDEX IF NOT EXISTS property_listings_fetched_at_idx ON property_listings (fetched_at);

-- ============================================================
-- 013: Saved searches extensions
-- ============================================================
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS criteria JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON saved_searches (user_id);
CREATE INDEX IF NOT EXISTS saved_searches_last_notified_idx ON saved_searches (last_notified_at);

-- ============================================================
-- 014: Overlays (postcode_areas extensions — NO schools table here, see 028)
-- ============================================================
ALTER TABLE postcode_areas
  ADD COLUMN IF NOT EXISTS flood_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nearest_park_name TEXT,
  ADD COLUMN IF NOT EXISTS nearest_park_distance_m INTEGER,
  ADD COLUMN IF NOT EXISTS park_count_within_1km INTEGER,
  ADD COLUMN IF NOT EXISTS parks_updated_at TIMESTAMPTZ;

-- ============================================================
-- 015: Provider-editable columns on nurseries
-- ============================================================
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS claimed_by_user_id UUID;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS photos TEXT[];
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS provider_updated_at TIMESTAMPTZ;

-- ============================================================
-- 016: User roles
-- ============================================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role IN ('customer','provider','admin'));
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

CREATE OR REPLACE FUNCTION public.promote_on_claim_approval()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.user_profiles
       SET role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'provider' END, updated_at = NOW()
     WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_claim_approved ON nursery_claims;
CREATE TRIGGER on_claim_approved
  AFTER UPDATE ON nursery_claims
  FOR EACH ROW EXECUTE FUNCTION public.promote_on_claim_approval();

DROP POLICY IF EXISTS "Admins read all profiles" ON user_profiles;
CREATE POLICY "Admins read all profiles" ON user_profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============================================================
-- 017: Travel time cache
-- ============================================================
CREATE TABLE IF NOT EXISTS travel_time_cache (
  key TEXT PRIMARY KEY,
  from_lat DOUBLE PRECISION NOT NULL, from_lng DOUBLE PRECISION NOT NULL,
  to_lat DOUBLE PRECISION NOT NULL, to_lng DOUBLE PRECISION NOT NULL,
  mode TEXT NOT NULL, duration_s INT NOT NULL, distance_m INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS travel_time_cache_created_at_idx ON travel_time_cache (created_at);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS work_postcode TEXT;

-- ============================================================
-- 018: Decision engine
-- ============================================================
CREATE TABLE IF NOT EXISTS user_quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  child_dob DATE, child_name TEXT,
  urgency TEXT CHECK (urgency IN ('asap','3_months','6_months','exploring')),
  commute_from TEXT CHECK (commute_from IN ('home','work','both')),
  commute_postcode TEXT,
  budget_min INTEGER, budget_max INTEGER,
  priority_order TEXT[] DEFAULT '{}', must_haves TEXT[] DEFAULT '{}',
  min_grade TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_quiz_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own quiz" ON user_quiz_responses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS quality_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS cost_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS availability_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS staff_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS sentiment_score SMALLINT;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS dimension_scores_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS nursery_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL CHECK (age_group IN ('0-1','1-2','2-3','3-4','4-5')),
  session_type TEXT NOT NULL CHECK (session_type IN ('full_day','half_day_am','half_day_pm','flexible')),
  fee_per_month NUMERIC(8,2), hours_per_week NUMERIC(4,1),
  funded_hours_deducted BOOLEAN DEFAULT false, effective_monthly_cost NUMERIC(8,2),
  meals_included BOOLEAN DEFAULT false,
  source TEXT CHECK (source IN ('provider','parent','estimated')) DEFAULT 'parent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nursery_pricing_nursery ON nursery_pricing(nursery_id);

CREATE TABLE IF NOT EXISTS nursery_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL CHECK (age_group IN ('0-1','1-2','2-3','3-4','4-5')),
  total_capacity INTEGER, current_enrolled INTEGER DEFAULT 0,
  waitlist_count INTEGER DEFAULT 0,
  next_available DATE, next_intake DATE,
  updated_by UUID, updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nursery_availability_nursery ON nursery_availability(nursery_id);

CREATE TABLE IF NOT EXISTS nursery_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  total_staff INTEGER, qualified_teachers INTEGER, level_3_plus INTEGER,
  avg_tenure_months INTEGER,
  ratio_under_2 TEXT, ratio_2_to_3 TEXT, ratio_3_plus TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  child_name TEXT, child_dob DATE, preferred_start DATE,
  session_preference TEXT, message TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','queued','opened','responded','visit_booked','place_offered','accepted','declined')),
  provider_notes TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(), responded_at TIMESTAMPTZ
);
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own enquiries" ON enquiries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create enquiries" ON enquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_user ON enquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_enquiries_nursery ON enquiries(nursery_id);

ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS category_scores JSONB;

-- -- SPLIT POINT 2 -- paste everything above first if timeout --

-- ============================================================
-- 019: Visit booking
-- ============================================================
CREATE TABLE IF NOT EXISTS visit_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL, slot_time TIME NOT NULL,
  duration_min INTEGER DEFAULT 30, capacity INTEGER DEFAULT 1, booked INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visit_slots_nursery_date ON visit_slots(nursery_id, slot_date);

CREATE TABLE IF NOT EXISTS visit_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES visit_slots(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nursery_id UUID REFERENCES nurseries(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE visit_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own bookings" ON visit_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create bookings" ON visit_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_user ON visit_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_bookings_nursery ON visit_bookings(nursery_id);

CREATE TABLE IF NOT EXISTS visit_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES visit_bookings(id) ON DELETE CASCADE,
  user_id UUID, nursery_id UUID,
  overall_impression INTEGER CHECK (overall_impression BETWEEN 1 AND 5),
  staff_friendliness INTEGER CHECK (staff_friendliness BETWEEN 1 AND 5),
  facilities_quality INTEGER CHECK (facilities_quality BETWEEN 1 AND 5),
  would_apply BOOLEAN, feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS compare_count INTEGER DEFAULT 0;

-- ============================================================
-- 020: Notifications + messaging
-- ============================================================
CREATE TABLE IF NOT EXISTS enquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id UUID REFERENCES enquiries(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_role TEXT NOT NULL CHECK (sender_role IN ('parent','provider')),
  body TEXT NOT NULL, read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_enquiry_messages_enquiry ON enquiry_messages(enquiry_id, created_at);
ALTER TABLE enquiry_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enquiry participants see messages" ON enquiry_messages
  FOR SELECT USING (
    sender_id = auth.uid() OR
    enquiry_id IN (SELECT id FROM enquiries WHERE user_id = auth.uid()) OR
    enquiry_id IN (
      SELECT e.id FROM enquiries e
      JOIN nurseries n ON n.id = e.nursery_id
      JOIN nursery_claims nc ON nc.urn = n.urn
      WHERE nc.user_id = auth.uid() AND nc.status = 'approved'
    )
  );
CREATE POLICY "Enquiry participants send messages" ON enquiry_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, title TEXT NOT NULL, body TEXT, link TEXT,
  read_at TIMESTAMPTZ, email_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 021: Monetization / provider subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro','premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','past_due','cancelled','trialing')),
  stripe_customer_id TEXT, stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  enquiry_credits INTEGER DEFAULT 5, enquiry_credits_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_sub_user ON provider_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_sub_stripe ON provider_subscriptions(stripe_customer_id);

ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS provider_tier TEXT DEFAULT 'free';

CREATE TABLE IF NOT EXISTS tier_limits (
  tier TEXT PRIMARY KEY, monthly_price_gbp INTEGER NOT NULL,
  enquiry_credits INTEGER NOT NULL, featured_listing BOOLEAN DEFAULT false,
  analytics_advanced BOOLEAN DEFAULT false, priority_search BOOLEAN DEFAULT false,
  custom_branding BOOLEAN DEFAULT false, description TEXT
);

INSERT INTO tier_limits (tier, monthly_price_gbp, enquiry_credits, featured_listing, analytics_advanced, priority_search, custom_branding, description) VALUES
  ('free', 0, 5, false, false, false, false, 'Basic listing with 5 enquiry views/month'),
  ('pro', 29, 50, true, true, true, false, 'Featured listing, priority search, 50 enquiry views/month'),
  ('premium', 79, -1, true, true, true, true, 'Unlimited enquiries, custom branding, all features')
ON CONFLICT (tier) DO NOTHING;

ALTER TABLE provider_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own provider subscription" ON provider_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role bypasses provider subscription RLS" ON provider_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 022: Admin improvements
-- ============================================================
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS flagged_at TIMESTAMPTZ;
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS flagged_by UUID;
CREATE INDEX IF NOT EXISTS idx_nursery_reviews_status ON nursery_reviews(status);
CREATE INDEX IF NOT EXISTS idx_nursery_claims_status ON nursery_claims(status);

-- ============================================================
-- 023: Email lifecycle
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_to TEXT NOT NULL, template TEXT NOT NULL, subject TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','bounced','failed')),
  resend_id TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_log_user ON email_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_template ON email_log(template);

CREATE TABLE IF NOT EXISTS drip_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence TEXT NOT NULL, step INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(), next_send_at TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false, paused BOOLEAN DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drip_user_seq ON drip_sequences(user_id, sequence);
CREATE INDEX IF NOT EXISTS idx_drip_next_send ON drip_sequences(next_send_at) WHERE completed = false AND paused = false;

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_weekly_digest BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_new_nurseries BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_marketing BOOLEAN DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- ============================================================
-- 024: Provider invites
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn TEXT NOT NULL, email TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent','opened','clicked','claimed')),
  sent_at TIMESTAMPTZ DEFAULT NOW(), opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ, claimed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_provider_invites_urn ON provider_invites(urn);
CREATE INDEX IF NOT EXISTS idx_provider_invites_status ON provider_invites(status);

-- ============================================================
-- 025: Trigram fuzzy search
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_nurseries_name_trgm ON nurseries USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nurseries_town_trgm ON nurseries USING gin (town gin_trgm_ops);

CREATE OR REPLACE FUNCTION autocomplete_suggestions(query_text text, max_results int DEFAULT 8)
RETURNS TABLE (type text, label text, urn text, postcode text, similarity_score real)
LANGUAGE plpgsql AS $$
DECLARE q text := trim(query_text); pattern text := '%' || q || '%';
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);
  RETURN QUERY
  (SELECT 'nursery'::text, n.name || COALESCE(', ' || n.town, ''), n.urn::text, n.postcode::text,
    similarity(n.name, q) FROM nurseries n
    WHERE n.location IS NOT NULL AND n.registration_status = 'Active' AND n.name ILIKE pattern
    ORDER BY similarity(n.name, q) DESC LIMIT max_results)
  UNION ALL
  (SELECT 'nursery'::text, n.name || COALESCE(', ' || n.town, ''), n.urn::text, n.postcode::text,
    similarity(n.name, q) FROM nurseries n
    WHERE n.location IS NOT NULL AND n.registration_status = 'Active' AND n.name % q AND NOT (n.name ILIKE pattern)
    ORDER BY similarity(n.name, q) DESC LIMIT max_results)
  UNION ALL
  (SELECT DISTINCT ON (split_part(n.postcode, ' ', 1))
    'area'::text, split_part(n.postcode, ' ', 1) || COALESCE(' — ' || n.town, ''), NULL::text,
    split_part(n.postcode, ' ', 1),
    GREATEST(similarity(n.town, q), similarity(n.postcode, q))
    FROM nurseries n
    WHERE n.location IS NOT NULL AND n.registration_status = 'Active'
      AND (n.town ILIKE pattern OR n.postcode ILIKE (q || '%') OR n.town % q)
    ORDER BY split_part(n.postcode, ' ', 1), GREATEST(similarity(n.town, q), similarity(n.postcode, q)) DESC
    LIMIT max_results)
  ORDER BY similarity_score DESC LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION fuzzy_search_nurseries(
  query_text text, max_results int DEFAULT 50, min_similarity real DEFAULT 0.15
)
RETURNS TABLE (
  id uuid, urn text, name text, provider_type text, address_line1 text,
  town text, postcode text, local_authority text, region text,
  phone text, email text, website text,
  ofsted_overall_grade text, last_inspection_date date, inspection_report_url text,
  total_places int, places_funded_2yr int, places_funded_3_4yr int,
  lat double precision, lng double precision,
  google_rating numeric, google_review_count int,
  fee_avg_monthly int, fee_report_count int,
  review_count int, review_avg_rating numeric,
  featured boolean, registration_status text, enforcement_notice boolean,
  match_score real, matched_field text
) LANGUAGE plpgsql AS $$
DECLARE q text := trim(query_text);
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);
  RETURN QUERY
  SELECT n.id, n.urn, n.name, n.provider_type, n.address_line1,
    n.town, n.postcode, n.local_authority, n.region, n.phone, n.email, n.website,
    n.ofsted_overall_grade, n.last_inspection_date, n.inspection_report_url,
    n.total_places, n.places_funded_2yr, n.places_funded_3_4yr,
    n.lat::double precision, n.lng::double precision,
    n.google_rating, n.google_review_count, n.fee_avg_monthly, n.fee_report_count,
    n.review_count, n.review_avg_rating, n.featured, n.registration_status, n.enforcement_notice,
    GREATEST(similarity(n.name, q), similarity(COALESCE(n.town, ''), q), similarity(COALESCE(n.postcode, ''), q)) AS match_score,
    CASE
      WHEN similarity(n.name, q) >= similarity(COALESCE(n.town, ''), q)
        AND similarity(n.name, q) >= similarity(COALESCE(n.postcode, ''), q) THEN n.name
      WHEN similarity(COALESCE(n.town, ''), q) >= similarity(COALESCE(n.postcode, ''), q) THEN n.town
      ELSE n.postcode END AS matched_field
  FROM nurseries n
  WHERE n.location IS NOT NULL AND n.registration_status = 'Active'
    AND (similarity(n.name, q) >= min_similarity OR similarity(COALESCE(n.town, ''), q) >= min_similarity
      OR similarity(COALESCE(n.postcode, ''), q) >= min_similarity)
  ORDER BY match_score DESC LIMIT max_results;
END;
$$;

-- ============================================================
-- 026: Saved search alerts
-- ============================================================
ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_saved_searches_alert_on_new ON saved_searches (last_alerted_at) WHERE alert_on_new = true;

-- ============================================================
-- 027: Enhanced listings (photos, fees)
-- ============================================================
CREATE TABLE IF NOT EXISTS nursery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL, storage_path TEXT NOT NULL, public_url TEXT NOT NULL,
  display_order INTEGER DEFAULT 0, caption TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nursery_photos_urn ON nursery_photos (nursery_urn);

ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS photo_gallery BOOLEAN DEFAULT false;
ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS custom_description BOOLEAN DEFAULT false;
ALTER TABLE tier_limits ADD COLUMN IF NOT EXISTS fee_management BOOLEAN DEFAULT false;

UPDATE tier_limits SET photo_gallery = false, custom_description = false, fee_management = false WHERE tier = 'free';
UPDATE tier_limits SET photo_gallery = true, custom_description = true, fee_management = true WHERE tier = 'pro';
UPDATE tier_limits SET photo_gallery = true, custom_description = true, fee_management = true WHERE tier = 'premium';

CREATE TABLE IF NOT EXISTS nursery_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT,
  age_group TEXT,
  session_type TEXT,
  price_gbp NUMERIC(8,2),
  fee_per_month INTEGER,
  hours_per_week INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nursery_fees_urn ON nursery_fees (nursery_urn);

ALTER TABLE nursery_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert fees" ON nursery_fees;
CREATE POLICY "Anyone can insert fees" ON nursery_fees FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Anyone can read fees" ON nursery_fees;
CREATE POLICY "Anyone can read fees" ON nursery_fees FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role manages fees" ON nursery_fees;
CREATE POLICY "Service role manages fees" ON nursery_fees FOR ALL USING (auth.role() = 'service_role');

-- -- SPLIT POINT 3 -- paste everything above first if timeout --

-- ============================================================
-- 028: Schools (definitive version)
-- ============================================================
DROP TABLE IF EXISTS schools CASCADE;

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  phase TEXT,
  ofsted_rating TEXT,
  last_inspection_date DATE,
  address TEXT, town TEXT, postcode TEXT, local_authority TEXT,
  lat NUMERIC(10,7), lng NUMERIC(10,7),
  location GEOGRAPHY(Point, 4326),
  pupils INTEGER, age_range TEXT, website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schools_location ON schools USING gist (location);
CREATE INDEX IF NOT EXISTS idx_schools_phase ON schools (phase) WHERE location IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_schools_postcode ON schools (postcode) WHERE postcode IS NOT NULL;

CREATE OR REPLACE FUNCTION schools_set_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE NEW.location := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_set_location ON schools;
CREATE TRIGGER trg_schools_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON schools
  FOR EACH ROW EXECUTE FUNCTION schools_set_location();

DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION search_schools_near(
  search_lat FLOAT, search_lng FLOAT,
  radius_km FLOAT DEFAULT 3, phase_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, urn TEXT, name TEXT, type TEXT, phase TEXT,
  ofsted_rating TEXT, last_inspection_date DATE,
  address TEXT, town TEXT, postcode TEXT, local_authority TEXT,
  lat NUMERIC, lng NUMERIC, pupils INTEGER, age_range TEXT, website TEXT,
  distance_km FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT s.id, s.urn, s.name, s.type, s.phase,
    s.ofsted_rating, s.last_inspection_date,
    s.address, s.town, s.postcode, s.local_authority,
    s.lat, s.lng, s.pupils, s.age_range, s.website,
    ST_Distance(s.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography) / 1000.0 AS distance_km
  FROM schools s
  WHERE s.location IS NOT NULL
    AND s.location && ST_Expand(ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326), radius_km / 111.0)
    AND ST_DWithin(s.location::geography, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography, radius_km * 1000)
    AND (phase_filter IS NULL OR s.phase = phase_filter)
  ORDER BY distance_km ASC LIMIT 50;
$$;

-- ============================================================
-- 029: Ofsted changes tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS ofsted_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL, previous_grade TEXT, new_grade TEXT NOT NULL,
  change_date TIMESTAMPTZ DEFAULT NOW(), notified BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_ofsted_changes_nursery ON ofsted_changes (nursery_urn);
CREATE INDEX IF NOT EXISTS idx_ofsted_changes_unnotified ON ofsted_changes (change_date) WHERE notified = false;

-- ============================================================
-- 030: Review moderation enhancements
-- ============================================================
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_reviews_status ON nursery_reviews (status);

-- ============================================================
-- 031: Availability / waitlist (nurseries columns)
-- ============================================================
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS spots_available INTEGER;
ALTER TABLE nurseries ADD COLUMN IF NOT EXISTS has_waitlist BOOLEAN DEFAULT false;

-- ============================================================
-- 032: Parent Q&A
-- ============================================================
CREATE TABLE IF NOT EXISTS nursery_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL, user_id UUID NOT NULL,
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nursery_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES nursery_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, is_provider BOOLEAN DEFAULT false,
  answer TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_urn ON nursery_questions (nursery_urn) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_answers_question ON nursery_answers (question_id) WHERE status = 'published';

-- ============================================================
-- 033: Notification preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email_new_review BOOLEAN DEFAULT true, email_qa_answer BOOLEAN DEFAULT true,
  email_saved_search_alert BOOLEAN DEFAULT true, email_ofsted_change BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT false, email_marketing BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences (user_id);

-- ============================================================
-- 034: Promotions + report caches (parent subs removed)
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT, image_url TEXT, link_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'swimming','music','tutoring','baby_gear','dance',
    'sports','soft_play','arts','language','childcare','health','other'
  )),
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  postcode_district TEXT, radius_km NUMERIC DEFAULT 10,
  active BOOLEAN DEFAULT true, created_by UUID,
  start_date DATE, end_date DATE,
  click_count INTEGER DEFAULT 0, impression_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION promotions_set_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::GEOGRAPHY;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_promotions_set_location ON promotions;
CREATE TRIGGER trg_promotions_set_location
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION promotions_set_location();

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_location ON promotions USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(category);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

CREATE TABLE IF NOT EXISTS provider_reports_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, urn TEXT NOT NULL, report_date DATE NOT NULL,
  views INTEGER DEFAULT 0, enquiries INTEGER DEFAULT 0,
  compares INTEGER DEFAULT 0, shortlists INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(urn, report_date)
);
CREATE INDEX IF NOT EXISTS idx_prc_urn_date ON provider_reports_cache(urn, report_date);

CREATE TABLE IF NOT EXISTS admin_reports_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  total_users INTEGER DEFAULT 0, new_users INTEGER DEFAULT 0,
  total_providers INTEGER DEFAULT 0, total_nurseries INTEGER DEFAULT 0,
  claimed_nurseries INTEGER DEFAULT 0, active_subscriptions INTEGER DEFAULT 0,
  mrr_gbp NUMERIC DEFAULT 0,
  total_enquiries INTEGER DEFAULT 0, new_enquiries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION search_promotions_near(
  search_lat DOUBLE PRECISION, search_lng DOUBLE PRECISION,
  search_radius_km DOUBLE PRECISION DEFAULT 10, cat_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, title TEXT, description TEXT, image_url TEXT, link_url TEXT, category TEXT,
  distance_km DOUBLE PRECISION, impression_count INTEGER, click_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.description, p.image_url, p.link_url, p.category,
    ROUND((ST_Distance(p.location, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::GEOGRAPHY) / 1000.0)::NUMERIC, 2)::DOUBLE PRECISION,
    p.impression_count, p.click_count
  FROM promotions p
  WHERE p.active = true AND p.location IS NOT NULL
    AND ST_DWithin(p.location, ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::GEOGRAPHY, search_radius_km * 1000)
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (cat_filter IS NULL OR p.category = cat_filter)
  ORDER BY distance_km LIMIT 10;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 035: Auth enhancements
-- ============================================================
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone TEXT;
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- ============================================================
-- 036: Migration safety guard
-- ============================================================
CREATE TABLE IF NOT EXISTS _migration_guard (
  id SERIAL PRIMARY KEY, description TEXT NOT NULL, applied_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO _migration_guard (description)
SELECT 'Production data initialized — do not re-run destructive migrations (005, 007, 015, 034)'
WHERE NOT EXISTS (SELECT 1 FROM _migration_guard WHERE id = 1);

-- ============================================================
-- 039: Enquiry queuing
-- ============================================================
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS requires_admin_review BOOLEAN DEFAULT false;
ALTER TABLE enquiries ADD COLUMN IF NOT EXISTS parent_email TEXT;

DROP POLICY IF EXISTS "Service role manages notifications" ON notifications;
CREATE POLICY "Service role manages notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role manages enquiries" ON enquiries;
CREATE POLICY "Service role manages enquiries" ON enquiries FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 040: Reviews user_id
-- ============================================================
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS idx_nursery_reviews_user_id ON nursery_reviews (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE nursery_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read published reviews" ON nursery_reviews;
CREATE POLICY "Anyone can read published reviews" ON nursery_reviews FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "Anyone can insert reviews" ON nursery_reviews;
CREATE POLICY "Anyone can insert reviews" ON nursery_reviews FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service role manages reviews" ON nursery_reviews;
CREATE POLICY "Service role manages reviews" ON nursery_reviews FOR ALL USING (auth.role() = 'service_role');

-- -- SPLIT POINT 4 -- paste everything above first if timeout --

-- ============================================================
-- 043: Shared shortlists
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  urns TEXT[] NOT NULL, name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);
CREATE INDEX IF NOT EXISTS idx_shared_shortlists_token ON shared_shortlists (token);
ALTER TABLE shared_shortlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read shared shortlists by token" ON shared_shortlists FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create shared shortlists" ON shared_shortlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role manages shared shortlists" ON shared_shortlists FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 044: Team access
-- ============================================================
CREATE TABLE IF NOT EXISTS nursery_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_urn TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'manager' CHECK (role IN ('owner', 'manager', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (nursery_urn, user_id)
);
CREATE INDEX IF NOT EXISTS idx_nursery_team_urn ON nursery_team_members (nursery_urn);
CREATE INDEX IF NOT EXISTS idx_nursery_team_user ON nursery_team_members (user_id);
ALTER TABLE nursery_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see teams they belong to" ON nursery_team_members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role manages teams" ON nursery_team_members FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 045: Waitlist
-- ============================================================
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nursery_id UUID NOT NULL REFERENCES nurseries(id) ON DELETE CASCADE,
  nursery_urn TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  child_name TEXT, child_dob DATE, parent_email TEXT, age_group TEXT, notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','offered','accepted','expired','cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(), notified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_waitlist_nursery ON waitlist_entries (nursery_id, status);
CREATE INDEX IF NOT EXISTS idx_waitlist_user ON waitlist_entries (user_id);
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own waitlist entries" ON waitlist_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can join waitlist" ON waitlist_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages waitlist" ON waitlist_entries FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 048: User activity log
-- ============================================================
CREATE TABLE IF NOT EXISTS user_activity_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT, event TEXT NOT NULL, target_urn TEXT,
  metadata JSONB DEFAULT '{}', ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_user ON user_activity_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_event ON user_activity_log (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_log (created_at DESC);

CREATE OR REPLACE FUNCTION increment_view_count(nursery_urn TEXT)
RETURNS VOID AS $$
BEGIN UPDATE nurseries SET view_count = COALESCE(view_count, 0) + 1 WHERE urn = nursery_urn; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_compare_count(nursery_urn TEXT)
RETURNS VOID AS $$
BEGIN UPDATE nurseries SET compare_count = COALESCE(compare_count, 0) + 1 WHERE urn = nursery_urn; END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 052: Job runs
-- ============================================================
CREATE TABLE IF NOT EXISTS job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
  result JSONB, triggered_by UUID, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_runs_type_started ON job_runs (job_type, started_at DESC);

-- ============================================================
-- 053: Invite campaign type
-- ============================================================
ALTER TABLE provider_invites ADD COLUMN IF NOT EXISTS campaign_type TEXT DEFAULT 'invite';

-- ============================================================
-- 054: Google reviews
-- ============================================================
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'nurserymatch';
ALTER TABLE nursery_reviews ADD COLUMN IF NOT EXISTS google_review_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nursery_reviews_google_id
  ON nursery_reviews (google_review_id) WHERE google_review_id IS NOT NULL;

-- ============================================================
-- DONE — All 49 migrations applied.
-- ============================================================
