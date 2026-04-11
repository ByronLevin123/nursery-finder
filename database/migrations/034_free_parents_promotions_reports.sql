-- 034: Free parents, promotions system, report caches
-- 1. Drop parent subscriptions (parents now use everything free)
-- 2. Create promotions table for admin-managed contextual ads
-- 3. Create report cache tables for provider + admin dashboards

-- ============================================================
-- 1. Remove parent subscriptions
-- ============================================================
DROP TABLE IF EXISTS parent_subscriptions;

-- ============================================================
-- 2. Promotions table
-- ============================================================
CREATE TABLE IF NOT EXISTS promotions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT,
  image_url         TEXT,
  link_url          TEXT NOT NULL,
  category          TEXT NOT NULL CHECK (category IN (
    'swimming', 'music', 'tutoring', 'baby_gear', 'dance',
    'sports', 'arts', 'language', 'childcare', 'health', 'other'
  )),
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  location          GEOGRAPHY(POINT, 4326),
  postcode_district TEXT,
  radius_km         NUMERIC DEFAULT 10,
  active            BOOLEAN DEFAULT true,
  created_by        UUID,
  start_date        DATE,
  end_date          DATE,
  click_count       INTEGER DEFAULT 0,
  impression_count  INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-compute location from lat/lng
CREATE OR REPLACE FUNCTION promotions_set_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::GEOGRAPHY;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_promotions_set_location
  BEFORE INSERT OR UPDATE ON promotions
  FOR EACH ROW EXECUTE FUNCTION promotions_set_location();

CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_promotions_location ON promotions USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_promotions_category ON promotions(category);
CREATE INDEX IF NOT EXISTS idx_promotions_dates ON promotions(start_date, end_date);

-- ============================================================
-- 3. Provider reports cache (daily aggregates per nursery)
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_reports_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID,
  urn             TEXT NOT NULL,
  report_date     DATE NOT NULL,
  views           INTEGER DEFAULT 0,
  enquiries       INTEGER DEFAULT 0,
  compares        INTEGER DEFAULT 0,
  shortlists      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(urn, report_date)
);

CREATE INDEX IF NOT EXISTS idx_prc_urn_date ON provider_reports_cache(urn, report_date);

-- ============================================================
-- 4. Admin reports cache (daily platform snapshots)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_reports_cache (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date           DATE NOT NULL UNIQUE,
  total_users           INTEGER DEFAULT 0,
  new_users             INTEGER DEFAULT 0,
  total_providers       INTEGER DEFAULT 0,
  total_nurseries       INTEGER DEFAULT 0,
  claimed_nurseries     INTEGER DEFAULT 0,
  active_subscriptions  INTEGER DEFAULT 0,
  mrr_gbp               NUMERIC DEFAULT 0,
  total_enquiries       INTEGER DEFAULT 0,
  new_enquiries         INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. RPC for nearby promotions (PostGIS)
-- ============================================================
CREATE OR REPLACE FUNCTION search_promotions_near(
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  radius_km  DOUBLE PRECISION DEFAULT 10,
  cat_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  title            TEXT,
  description      TEXT,
  image_url        TEXT,
  link_url         TEXT,
  category         TEXT,
  distance_km      DOUBLE PRECISION,
  impression_count INTEGER,
  click_count      INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.title, p.description, p.image_url, p.link_url, p.category,
    ROUND((ST_Distance(
      p.location,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::GEOGRAPHY
    ) / 1000.0)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
    p.impression_count,
    p.click_count
  FROM promotions p
  WHERE p.active = true
    AND p.location IS NOT NULL
    AND ST_DWithin(
      p.location,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::GEOGRAPHY,
      radius_km * 1000
    )
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (cat_filter IS NULL OR p.category = cat_filter)
  ORDER BY distance_km
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
