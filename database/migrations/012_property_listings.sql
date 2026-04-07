-- 012_property_listings.sql — cached property listings (sale + rent) from PropertyData
-- Prices stored in whole pounds (sale = total price, rent = £/week).
-- Staleness is determined by MAX(fetched_at) per (postcode_district, listing_type).

CREATE TABLE IF NOT EXISTS property_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  postcode_district TEXT NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'rent')),
  external_id TEXT,
  address TEXT,
  postcode TEXT,
  price INTEGER, -- whole pounds: total price (sale) or per-week (rent)
  bedrooms INTEGER,
  bathrooms INTEGER,
  property_type TEXT,
  description TEXT,
  image_url TEXT,
  listing_url TEXT,
  agent_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  raw JSONB,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique only when external_id is present (Postgres treats nulls as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS property_listings_unique_external
  ON property_listings (postcode_district, listing_type, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS property_listings_district_type_idx
  ON property_listings (postcode_district, listing_type);
CREATE INDEX IF NOT EXISTS property_listings_price_idx ON property_listings (price);
CREATE INDEX IF NOT EXISTS property_listings_bedrooms_idx ON property_listings (bedrooms);
CREATE INDEX IF NOT EXISTS property_listings_fetched_at_idx ON property_listings (fetched_at);
