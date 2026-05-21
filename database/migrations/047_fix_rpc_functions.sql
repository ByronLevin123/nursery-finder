-- Fix: recreate search_schools_near to match current table structure
-- Fix: rename radius_km parameter in search_promotions_near to avoid column name clash

-- ============================================================
-- 1. Fix search_schools_near — "structure of query does not match function result type"
-- ============================================================
CREATE OR REPLACE FUNCTION search_schools_near(
  search_lat    FLOAT,
  search_lng    FLOAT,
  radius_km     FLOAT DEFAULT 3,
  phase_filter  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  urn TEXT,
  name TEXT,
  type TEXT,
  phase TEXT,
  ofsted_rating TEXT,
  last_inspection_date DATE,
  address TEXT,
  town TEXT,
  postcode TEXT,
  local_authority TEXT,
  lat NUMERIC,
  lng NUMERIC,
  pupils INTEGER,
  age_range TEXT,
  website TEXT,
  distance_km FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    s.id, s.urn, s.name, s.type, s.phase,
    s.ofsted_rating, s.last_inspection_date,
    s.address, s.town, s.postcode, s.local_authority,
    s.lat, s.lng,
    s.pupils, s.age_range, s.website,
    ST_Distance(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM schools s
  WHERE
    s.location IS NOT NULL
    AND s.location && ST_Expand(
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326),
      radius_km / 111.0
    )
    AND ST_DWithin(
      s.location::geography,
      ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography,
      radius_km * 1000
    )
    AND (phase_filter IS NULL OR s.phase = phase_filter)
  ORDER BY distance_km ASC
  LIMIT 50;
$$;

-- ============================================================
-- 2. Fix search_promotions_near — "column reference radius_km is ambiguous"
--    Renamed parameter from radius_km to search_radius_km
-- ============================================================
CREATE OR REPLACE FUNCTION search_promotions_near(
  search_lat       DOUBLE PRECISION,
  search_lng       DOUBLE PRECISION,
  search_radius_km DOUBLE PRECISION DEFAULT 10,
  cat_filter       TEXT DEFAULT NULL
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
      search_radius_km * 1000
    )
    AND (p.start_date IS NULL OR p.start_date <= CURRENT_DATE)
    AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
    AND (cat_filter IS NULL OR p.category = cat_filter)
  ORDER BY distance_km
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;
