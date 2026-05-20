-- List price market insights: APPROVED-only MV, freshness meta, drill-down + trend RPCs

-- Freshness metadata
CREATE TABLE IF NOT EXISTS public.list_price_performance_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  refresh_source text NOT NULL DEFAULT 'trigger'
);

COMMENT ON TABLE public.list_price_performance_meta IS
  'Last refresh timestamp for list_price_performance materialized view';

-- Recreate MV with APPROVED + active quotes and plant consistency
DROP MATERIALIZED VIEW IF EXISTS public.list_price_performance;

CREATE MATERIALIZED VIEW public.list_price_performance AS
SELECT
  lp.id AS list_price_id,
  lp.master_recipe_id,
  mr.plant_id,
  mr.strength_fc,
  mr.placement_type,
  mr.slump,
  lp.base_price,
  lp.effective_date,
  COUNT(DISTINCT qd.quote_id) AS total_quotes,
  COALESCE(SUM(qd.volume), 0) AS total_volume_m3,
  COUNT(DISTINCT CASE WHEN qd.final_price < lp.base_price THEN qd.quote_id END) AS sub_floor_quotes,
  COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0) AS sub_floor_volume_m3,
  ROUND(
    COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
    / NULLIF(SUM(qd.volume), 0) * 100,
    1
  ) AS sub_floor_volume_pct,
  ROUND(SUM(qd.final_price * qd.volume) / NULLIF(SUM(qd.volume), 0), 2) AS vw_avg_price,
  ROUND(SUM((qd.final_price - lp.base_price) * qd.volume) / NULLIF(SUM(qd.volume), 0), 2) AS vw_avg_floor_delta,
  ROUND(
    SUM(CASE WHEN q.distance_range_code IN ('A', 'B') THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code IN ('A', 'B') THEN qd.volume END), 0),
    2
  ) AS vw_delta_zone_ab,
  ROUND(
    SUM(CASE WHEN q.distance_range_code = 'C' THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'C' THEN qd.volume END), 0),
    2
  ) AS vw_delta_zone_c,
  ROUND(
    SUM(CASE WHEN q.distance_range_code = 'D' THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'D' THEN qd.volume END), 0),
    2
  ) AS vw_delta_zone_d,
  ROUND(
    SUM(CASE WHEN q.distance_range_code = 'E' THEN (qd.final_price - lp.base_price) * qd.volume END)
    / NULLIF(SUM(CASE WHEN q.distance_range_code = 'E' THEN qd.volume END), 0),
    2
  ) AS vw_delta_zone_e,
  COALESCE(SUM(CASE WHEN q.distance_range_code IN ('A', 'B') THEN qd.volume END), 0) AS volume_zone_ab_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'C' THEN qd.volume END), 0) AS volume_zone_c_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'D' THEN qd.volume END), 0) AS volume_zone_d_m3,
  COALESCE(SUM(CASE WHEN q.distance_range_code = 'E' THEN qd.volume END), 0) AS volume_zone_e_m3,
  CASE
    WHEN COALESCE(SUM(qd.volume), 0) = 0 THEN 'NO_DATA'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price < lp.base_price THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.30 THEN 'UNDERSET'
    WHEN COALESCE(SUM(CASE WHEN qd.final_price > lp.base_price * 1.15 THEN qd.volume END), 0)
      / NULLIF(SUM(qd.volume), 0) > 0.50 THEN 'OVERSET'
    ELSE 'FIT'
  END AS market_fit
FROM public.list_prices lp
JOIN public.master_recipes mr ON mr.id = lp.master_recipe_id
LEFT JOIN public.quote_details qd
  ON qd.master_recipe_id = lp.master_recipe_id
  AND qd.pricing_path = 'LIST_PRICE'
LEFT JOIN public.quotes q
  ON q.id = qd.quote_id
  AND q.status = 'APPROVED'
  AND COALESCE(q.is_active, true) = true
  AND q.plant_id = mr.plant_id
  AND q.created_at::date >= lp.effective_date
  AND (lp.expires_at IS NULL OR q.created_at::date < lp.expires_at)
WHERE lp.is_active = true
GROUP BY
  lp.id, lp.master_recipe_id, mr.plant_id, mr.strength_fc, mr.placement_type, mr.slump,
  lp.base_price, lp.effective_date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lpp_id ON public.list_price_performance (list_price_id);
CREATE INDEX IF NOT EXISTS idx_lpp_plant ON public.list_price_performance (plant_id);
CREATE INDEX IF NOT EXISTS idx_lpp_market_fit ON public.list_price_performance (market_fit)
  WHERE market_fit IN ('UNDERSET', 'OVERSET');
CREATE INDEX IF NOT EXISTS idx_lpp_strength ON public.list_price_performance (strength_fc);

REFRESH MATERIALIZED VIEW public.list_price_performance;

INSERT INTO public.list_price_performance_meta (refreshed_at, refresh_source)
VALUES (now(), 'migration');

CREATE OR REPLACE FUNCTION public.refresh_list_price_performance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.list_price_performance;
  EXCEPTION
    WHEN OTHERS THEN
      REFRESH MATERIALIZED VIEW public.list_price_performance;
  END;
  INSERT INTO public.list_price_performance_meta (refreshed_at, refresh_source)
  VALUES (now(), COALESCE(TG_TABLE_NAME, 'trigger'));
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_list_price_performance_refreshed_at()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT refreshed_at
  FROM public.list_price_performance_meta
  ORDER BY refreshed_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_list_price_performance_refreshed_at() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_list_price_insight_detail(
  p_list_price_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS TABLE (
  quote_detail_id uuid,
  quote_id uuid,
  quote_number text,
  client_name text,
  construction_site text,
  quote_created_at timestamptz,
  quote_status text,
  volume numeric,
  final_price numeric,
  base_price numeric,
  price_delta numeric,
  weighted_contribution numeric,
  distance_range_code text,
  pricing_path text,
  is_sub_floor boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lp AS (
    SELECT lp.id, lp.master_recipe_id, lp.base_price, lp.effective_date, lp.expires_at, mr.plant_id
    FROM public.list_prices lp
    JOIN public.master_recipes mr ON mr.id = lp.master_recipe_id
    WHERE lp.id = p_list_price_id AND lp.is_active = true
  ),
  bounds AS (
    SELECT
      lp.*,
      COALESCE(p_from, lp.effective_date) AS from_date,
      COALESCE(p_to, CURRENT_DATE) AS to_date
    FROM lp
  )
  SELECT
    qd.id AS quote_detail_id,
    q.id AS quote_id,
    q.quote_number,
    COALESCE(c.business_name, '') AS client_name,
    q.construction_site,
    q.created_at AS quote_created_at,
    q.status AS quote_status,
    qd.volume,
    qd.final_price,
    b.base_price,
    (qd.final_price - b.base_price) AS price_delta,
    ((qd.final_price - b.base_price) * qd.volume) AS weighted_contribution,
    q.distance_range_code::text,
    qd.pricing_path,
    (qd.final_price < b.base_price) AS is_sub_floor
  FROM bounds b
  JOIN public.quote_details qd
    ON qd.master_recipe_id = b.master_recipe_id
    AND qd.pricing_path = 'LIST_PRICE'
  JOIN public.quotes q
    ON q.id = qd.quote_id
    AND q.status = 'APPROVED'
    AND COALESCE(q.is_active, true) = true
    AND q.plant_id = b.plant_id
    AND q.created_at::date >= b.effective_date
    AND (b.expires_at IS NULL OR q.created_at::date < b.expires_at)
    AND q.created_at::date >= b.from_date
    AND q.created_at::date <= b.to_date
  LEFT JOIN public.clients c ON c.id = q.client_id
  ORDER BY qd.volume DESC NULLS LAST, q.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_list_price_insight_detail(uuid, date, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_list_price_insight_trend(
  p_master_recipe_id uuid,
  p_plant_id uuid,
  p_grain text DEFAULT 'month'
)
RETURNS TABLE (
  period date,
  volume_m3 numeric,
  vw_avg_price numeric,
  vw_avg_floor_delta numeric,
  sub_floor_volume_pct numeric,
  vw_delta_zone_ab numeric,
  vw_delta_zone_c numeric,
  vw_delta_zone_d numeric,
  vw_delta_zone_e numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH lp AS (
    SELECT lp.id, lp.base_price, lp.effective_date, lp.expires_at
    FROM public.list_prices lp
    JOIN public.master_recipes mr ON mr.id = lp.master_recipe_id
    WHERE lp.master_recipe_id = p_master_recipe_id
      AND mr.plant_id = p_plant_id
      AND lp.is_active = true
    ORDER BY lp.effective_date DESC
    LIMIT 1
  ),
  rows AS (
    SELECT
      date_trunc(COALESCE(NULLIF(p_grain, ''), 'month'), q.created_at)::date AS period,
      qd.volume,
      qd.final_price,
      lp.base_price,
      q.distance_range_code
    FROM lp
    JOIN public.quote_details qd
      ON qd.master_recipe_id = p_master_recipe_id
      AND qd.pricing_path = 'LIST_PRICE'
    JOIN public.quotes q
      ON q.id = qd.quote_id
      AND q.status = 'APPROVED'
      AND COALESCE(q.is_active, true) = true
      AND q.plant_id = p_plant_id
      AND q.created_at::date >= lp.effective_date
      AND (lp.expires_at IS NULL OR q.created_at::date < lp.expires_at)
  )
  SELECT
    period,
    COALESCE(SUM(volume), 0) AS volume_m3,
    ROUND(SUM(final_price * volume) / NULLIF(SUM(volume), 0), 2) AS vw_avg_price,
    ROUND(SUM((final_price - base_price) * volume) / NULLIF(SUM(volume), 0), 2) AS vw_avg_floor_delta,
    ROUND(
      COALESCE(SUM(CASE WHEN final_price < base_price THEN volume END), 0)
      / NULLIF(SUM(volume), 0) * 100,
      1
    ) AS sub_floor_volume_pct,
    ROUND(
      SUM(CASE WHEN distance_range_code IN ('A', 'B') THEN (final_price - base_price) * volume END)
      / NULLIF(SUM(CASE WHEN distance_range_code IN ('A', 'B') THEN volume END), 0),
      2
    ) AS vw_delta_zone_ab,
    ROUND(
      SUM(CASE WHEN distance_range_code = 'C' THEN (final_price - base_price) * volume END)
      / NULLIF(SUM(CASE WHEN distance_range_code = 'C' THEN volume END), 0),
      2
    ) AS vw_delta_zone_c,
    ROUND(
      SUM(CASE WHEN distance_range_code = 'D' THEN (final_price - base_price) * volume END)
      / NULLIF(SUM(CASE WHEN distance_range_code = 'D' THEN volume END), 0),
      2
    ) AS vw_delta_zone_d,
    ROUND(
      SUM(CASE WHEN distance_range_code = 'E' THEN (final_price - base_price) * volume END)
      / NULLIF(SUM(CASE WHEN distance_range_code = 'E' THEN volume END), 0),
      2
    ) AS vw_delta_zone_e
  FROM rows
  GROUP BY period
  ORDER BY period;
$$;

GRANT EXECUTE ON FUNCTION public.get_list_price_insight_trend(uuid, uuid, text) TO authenticated;
