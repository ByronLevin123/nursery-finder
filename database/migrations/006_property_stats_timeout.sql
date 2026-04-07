-- Migration 006: raise statement timeout for compute_area_property_stats
-- The aggregation scans ~1.2M Land Registry rows and was hitting the default
-- PostgREST statement_timeout (~8s). Running it inside a function with a
-- longer local timeout fixes the 57014 errors on /api/v1/ingest/property-stats.

CREATE OR REPLACE FUNCTION compute_area_property_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  SET LOCAL statement_timeout = '10min';

  WITH stats AS (
    SELECT
      postcode_district,
      AVG(price)::INTEGER                                            AS avg_all,
      AVG(price) FILTER (WHERE property_type = 'F')::INTEGER         AS avg_flat,
      AVG(price) FILTER (WHERE property_type = 'T')::INTEGER         AS avg_terraced,
      AVG(price) FILTER (WHERE property_type = 'S')::INTEGER         AS avg_semi,
      AVG(price) FILTER (WHERE property_type = 'D')::INTEGER         AS avg_detached
    FROM land_registry_prices
    WHERE date_of_transfer >= (CURRENT_DATE - INTERVAL '12 months')
    GROUP BY postcode_district
  )
  UPDATE postcode_areas pa
  SET avg_sale_price_all       = s.avg_all,
      avg_sale_price_flat      = s.avg_flat,
      avg_sale_price_terraced  = s.avg_terraced,
      avg_sale_price_semi      = s.avg_semi,
      avg_sale_price_detached  = s.avg_detached,
      updated_at               = NOW()
  FROM stats s
  WHERE pa.postcode_district = s.postcode_district;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;
