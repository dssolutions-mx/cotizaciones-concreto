-- Fix get_quality_chart_data - simplified logic and corrected types
-- Applied: 2025-12-06

DROP FUNCTION IF EXISTS public.get_quality_chart_data(date, date, uuid, integer);

CREATE OR REPLACE FUNCTION public.get_quality_chart_data(
    p_from_date date,
    p_to_date date,
    p_plant_id uuid DEFAULT NULL,
    p_limit integer DEFAULT 500
)
RETURNS TABLE(
    muestreo_id uuid,
    fecha_muestreo date,
    fecha_muestreo_ts timestamp with time zone,
    avg_compliance numeric,
    avg_resistencia numeric,
    ensayo_count bigint,
    recipe_code text,
    strength_fc double precision,
    concrete_specs jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS muestreo_id,
        m.fecha_muestreo,
        m.fecha_muestreo_ts,
        AVG(e.porcentaje_cumplimiento) AS avg_compliance,
        AVG(e.resistencia_calculada) AS avg_resistencia,
        COUNT(e.id) AS ensayo_count,
        r.recipe_code::text AS recipe_code,
        r.strength_fc AS strength_fc,
        m.concrete_specs
    FROM muestreos m
    LEFT JOIN remisiones rem ON rem.id = m.remision_id
    LEFT JOIN recipes r ON r.id = rem.recipe_id
    JOIN muestras mu ON mu.muestreo_id = m.id
    JOIN ensayos e ON e.muestra_id = mu.id
    WHERE m.fecha_muestreo BETWEEN p_from_date AND p_to_date
      AND (p_plant_id IS NULL OR m.plant_id = p_plant_id)
      AND e.resistencia_calculada > 0
      AND e.is_edad_garantia = true
      AND e.is_ensayo_fuera_tiempo = false
    GROUP BY m.id, m.fecha_muestreo, m.fecha_muestreo_ts, m.concrete_specs, r.recipe_code, r.strength_fc
    ORDER BY m.fecha_muestreo DESC
    LIMIT p_limit;
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_quality_chart_data(date, date, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_chart_data(date, date, uuid, integer) TO anon;
