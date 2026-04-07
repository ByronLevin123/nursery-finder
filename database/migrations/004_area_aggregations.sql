-- Migration 004: Aggregate nursery counts and area lookups per postcode district
-- Populates postcode_areas with nursery_count_total/outstanding/good and centroid lat/lng
-- so area pages, area-aware modals, and family-score work today (without Land Registry).

CREATE OR REPLACE FUNCTION refresh_postcode_area_nursery_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  WITH district_stats AS (
    SELECT
      UPPER(SPLIT_PART(postcode, ' ', 1))                       AS postcode_district,
      MAX(local_authority)                                       AS local_authority,
      MAX(region)                                                AS region,
      COUNT(*)                                                   AS nursery_count_total,
      COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Outstanding') AS nursery_count_outstanding,
      COUNT(*) FILTER (WHERE ofsted_overall_grade = 'Good')        AS nursery_count_good,
      AVG(lat)::DECIMAL(10,7)                                    AS lat,
      AVG(lng)::DECIMAL(10,7)                                    AS lng
    FROM nurseries
    WHERE registration_status = 'Active'
      AND postcode IS NOT NULL
      AND postcode <> ''
    GROUP BY 1
  )
  INSERT INTO postcode_areas (
    postcode_district, local_authority, region,
    nursery_count_total, nursery_count_outstanding, nursery_count_good,
    nursery_outstanding_pct, lat, lng, updated_at
  )
  SELECT
    postcode_district, local_authority, region,
    nursery_count_total, nursery_count_outstanding, nursery_count_good,
    CASE WHEN nursery_count_total > 0
      THEN ROUND((nursery_count_outstanding::DECIMAL / nursery_count_total) * 100, 2)
      ELSE 0 END,
    lat, lng, NOW()
  FROM district_stats
  ON CONFLICT (postcode_district) DO UPDATE SET
    local_authority           = EXCLUDED.local_authority,
    region                    = EXCLUDED.region,
    nursery_count_total       = EXCLUDED.nursery_count_total,
    nursery_count_outstanding = EXCLUDED.nursery_count_outstanding,
    nursery_count_good        = EXCLUDED.nursery_count_good,
    nursery_outstanding_pct   = EXCLUDED.nursery_outstanding_pct,
    lat                       = COALESCE(EXCLUDED.lat, postcode_areas.lat),
    lng                       = COALESCE(EXCLUDED.lng, postcode_areas.lng),
    updated_at                = NOW();

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected;
END;
$$;

-- Aggregate Land Registry transactions into postcode_areas (when imported)
CREATE OR REPLACE FUNCTION compute_area_property_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
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
