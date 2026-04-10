-- 025: Trigram fuzzy search support
-- Enables pg_trgm extension and creates RPC functions for autocomplete + fuzzy search

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram indexes on name and town for fast fuzzy matching
CREATE INDEX IF NOT EXISTS idx_nurseries_name_trgm ON nurseries USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_nurseries_town_trgm ON nurseries USING gin (town gin_trgm_ops);

-- Autocomplete suggestions: prefix + fuzzy matching on name/town/postcode
CREATE OR REPLACE FUNCTION autocomplete_suggestions(query_text text, max_results int DEFAULT 8)
RETURNS TABLE (
  type text,
  label text,
  urn text,
  postcode text,
  similarity_score real
) LANGUAGE plpgsql AS $$
DECLARE
  q text := trim(query_text);
  pattern text := '%' || q || '%';
BEGIN
  -- Set a low similarity threshold for fuzzy matching
  PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);

  RETURN QUERY
  (
    -- Prefix/ilike matches on nursery name (high priority)
    SELECT
      'nursery'::text AS type,
      n.name || COALESCE(', ' || n.town, '') AS label,
      n.urn::text AS urn,
      n.postcode::text AS postcode,
      similarity(n.name, q) AS similarity_score
    FROM nurseries n
    WHERE n.location IS NOT NULL
      AND n.registration_status = 'Active'
      AND n.name ILIKE pattern
    ORDER BY similarity(n.name, q) DESC
    LIMIT max_results
  )
  UNION ALL
  (
    -- Fuzzy matches on nursery name (lower priority, excludes prefix matches)
    SELECT
      'nursery'::text AS type,
      n.name || COALESCE(', ' || n.town, '') AS label,
      n.urn::text AS urn,
      n.postcode::text AS postcode,
      similarity(n.name, q) AS similarity_score
    FROM nurseries n
    WHERE n.location IS NOT NULL
      AND n.registration_status = 'Active'
      AND n.name % q
      AND NOT (n.name ILIKE pattern)
    ORDER BY similarity(n.name, q) DESC
    LIMIT max_results
  )
  UNION ALL
  (
    -- Town matches
    SELECT DISTINCT ON (split_part(n.postcode, ' ', 1))
      'area'::text AS type,
      split_part(n.postcode, ' ', 1) || COALESCE(' — ' || n.town, '') AS label,
      NULL::text AS urn,
      split_part(n.postcode, ' ', 1) AS postcode,
      GREATEST(similarity(n.town, q), similarity(n.postcode, q)) AS similarity_score
    FROM nurseries n
    WHERE n.location IS NOT NULL
      AND n.registration_status = 'Active'
      AND (n.town ILIKE pattern OR n.postcode ILIKE (q || '%') OR n.town % q)
    ORDER BY split_part(n.postcode, ' ', 1), GREATEST(similarity(n.town, q), similarity(n.postcode, q)) DESC
    LIMIT max_results
  )
  ORDER BY similarity_score DESC
  LIMIT max_results;
END;
$$;

-- Fuzzy search: returns full nursery rows with match metadata
CREATE OR REPLACE FUNCTION fuzzy_search_nurseries(
  query_text text,
  max_results int DEFAULT 50,
  min_similarity real DEFAULT 0.15
)
RETURNS TABLE (
  id uuid,
  urn text,
  name text,
  provider_type text,
  address_line1 text,
  town text,
  postcode text,
  local_authority text,
  region text,
  phone text,
  email text,
  website text,
  ofsted_overall_grade text,
  last_inspection_date date,
  inspection_report_url text,
  total_places int,
  places_funded_2yr int,
  places_funded_3_4yr int,
  lat double precision,
  lng double precision,
  google_rating numeric,
  google_review_count int,
  fee_avg_monthly int,
  fee_report_count int,
  review_count int,
  review_avg_rating numeric,
  featured boolean,
  registration_status text,
  enforcement_notice boolean,
  match_score real,
  matched_field text
) LANGUAGE plpgsql AS $$
DECLARE
  q text := trim(query_text);
BEGIN
  PERFORM set_config('pg_trgm.similarity_threshold', '0.2', true);

  RETURN QUERY
  SELECT
    n.id, n.urn, n.name, n.provider_type, n.address_line1,
    n.town, n.postcode, n.local_authority, n.region,
    n.phone, n.email, n.website,
    n.ofsted_overall_grade, n.last_inspection_date, n.inspection_report_url,
    n.total_places, n.places_funded_2yr, n.places_funded_3_4yr,
    n.lat::double precision, n.lng::double precision,
    n.google_rating, n.google_review_count,
    n.fee_avg_monthly, n.fee_report_count,
    n.review_count, n.review_avg_rating,
    n.featured, n.registration_status, n.enforcement_notice,
    GREATEST(
      similarity(n.name, q),
      similarity(COALESCE(n.town, ''), q),
      similarity(COALESCE(n.postcode, ''), q)
    ) AS match_score,
    CASE
      WHEN similarity(n.name, q) >= similarity(COALESCE(n.town, ''), q)
        AND similarity(n.name, q) >= similarity(COALESCE(n.postcode, ''), q)
        THEN n.name
      WHEN similarity(COALESCE(n.town, ''), q) >= similarity(COALESCE(n.postcode, ''), q)
        THEN n.town
      ELSE n.postcode
    END AS matched_field
  FROM nurseries n
  WHERE n.location IS NOT NULL
    AND n.registration_status = 'Active'
    AND (
      similarity(n.name, q) >= min_similarity
      OR similarity(COALESCE(n.town, ''), q) >= min_similarity
      OR similarity(COALESCE(n.postcode, ''), q) >= min_similarity
    )
  ORDER BY match_score DESC
  LIMIT max_results;
END;
$$;
