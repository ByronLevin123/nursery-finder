-- 063_daily_active_visitors.sql — per-day unique visitor series for the growth
-- dashboard (tracking progress toward the daily-active-users target).
-- Returns one row per day for the last `days` days, with 0 for days that had
-- no traffic, so the admin DAU chart has no gaps.

CREATE OR REPLACE FUNCTION daily_active_visitors(days INT DEFAULT 30)
RETURNS TABLE(day DATE, visitors BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT d::date AS day,
         COUNT(DISTINCT a.ip_hash) AS visitors
  FROM generate_series(
         (CURRENT_DATE - GREATEST(days - 1, 0) * INTERVAL '1 day'),
         CURRENT_DATE,
         INTERVAL '1 day'
       ) d
  LEFT JOIN user_activity_log a
    ON a.event = 'page_visit'
   AND a.ip_hash IS NOT NULL
   AND a.created_at >= d::date
   AND a.created_at < (d::date + INTERVAL '1 day')
  GROUP BY d::date
  ORDER BY d::date;
$$;
