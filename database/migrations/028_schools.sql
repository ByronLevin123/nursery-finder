-- 028_schools.sql — School catchment overlay
-- Stores UK school data (from GIAS) for showing nearby primary schools on nursery profiles

CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  urn TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT,                -- 'Primary', 'Secondary', 'All-through'
  phase TEXT,               -- 'Primary', 'Secondary'
  ofsted_rating TEXT,       -- 'Outstanding', 'Good', 'Requires Improvement', 'Inadequate'
  last_inspection_date DATE,
  address TEXT,
  town TEXT,
  postcode TEXT,
  local_authority TEXT,
  lat NUMERIC(10,7),
  lng NUMERIC(10,7),
  location GEOGRAPHY(Point, 4326),
  pupils INTEGER,
  age_range TEXT,           -- '4-11', '3-11', etc
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spatial index for nearby-school queries
CREATE INDEX IF NOT EXISTS idx_schools_location ON schools USING gist (location);

-- Phase index for filtering Primary/Secondary with location
CREATE INDEX IF NOT EXISTS idx_schools_phase ON schools (phase) WHERE location IS NOT NULL;

-- Postcode index for ingest upsert lookups
CREATE INDEX IF NOT EXISTS idx_schools_postcode ON schools (postcode) WHERE postcode IS NOT NULL;

-- Trigger to auto-generate geography column from lat/lng
CREATE OR REPLACE FUNCTION schools_set_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schools_set_location ON schools;
CREATE TRIGGER trg_schools_set_location
  BEFORE INSERT OR UPDATE OF lat, lng ON schools
  FOR EACH ROW EXECUTE FUNCTION schools_set_location();

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS trg_schools_updated_at ON schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RPC function: find schools near a point, sorted by distance
-- Mirrors the search_nurseries_near pattern (two-stage PostGIS: bbox then distance)
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
