-- Migration 005: Unique constraint for Land Registry upserts
-- Without this index, the ingestion service's upsert(onConflict='postcode,date_of_transfer,price')
-- silently rejects most batches via PostgREST and only ~2k rows land instead of millions.

-- Drop any partial data so the next ingestion run is clean.
TRUNCATE land_registry_prices;

CREATE UNIQUE INDEX IF NOT EXISTS land_registry_prices_unique_idx
  ON land_registry_prices (postcode, date_of_transfer, price, property_type);
