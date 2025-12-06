-- Fix get_quality_chart_data return type mismatch
-- Error: "structure of query does not match function result type"
-- 
-- This migration fixes the column ordering in the SELECT statement
-- to match the RETURNS TABLE declaration

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
    strength_fc numeric,
    concrete_specs jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '30s'
AS $function$
BEGIN
    RETURN QUERY
    WITH filtered_muestreos AS (
        SELECT 
            m.id,
            m.fecha_muestreo AS fm_fecha_muestreo,
            m.fecha_muestreo_ts AS fm_fecha_muestreo_ts,
            m.concrete_specs AS fm_concrete_specs,
            r.recipe_code AS fm_recipe_code,
            r.strength_fc AS fm_strength_fc
        FROM muestreos m
        LEFT JOIN remisiones rem ON rem.id = m.remision_id
        LEFT JOIN recipes r ON r.id = rem.recipe_id
        WHERE m.fecha_muestreo BETWEEN p_from_date AND p_to_date
          AND (p_plant_id IS NULL OR m.plant_id = p_plant_id)
        ORDER BY m.fecha_muestreo DESC
        LIMIT p_limit
    ),
    muestreo_stats AS (
        SELECT 
            fm.id AS ms_muestreo_id,
            fm.fm_fecha_muestreo AS ms_fecha_muestreo,
            fm.fm_fecha_muestreo_ts AS ms_fecha_muestreo_ts,
            fm.fm_concrete_specs AS ms_concrete_specs,
            fm.fm_recipe_code AS ms_recipe_code,
            fm.fm_strength_fc AS ms_strength_fc,
            AVG(e.porcentaje_cumplimiento) AS ms_avg_compliance,
            AVG(e.resistencia_calculada) AS ms_avg_resistencia,
            COUNT(e.id) AS ms_ensayo_count
        FROM filtered_muestreos fm
        JOIN muestras mu ON mu.muestreo_id = fm.id
        JOIN ensayos e ON e.muestra_id = mu.id
        WHERE e.resistencia_calculada > 0
          AND e.is_edad_garantia = true
          AND e.is_ensayo_fuera_tiempo = false
        GROUP BY fm.id, fm.fm_fecha_muestreo, fm.fm_fecha_muestreo_ts, fm.fm_concrete_specs, fm.fm_recipe_code, fm.fm_strength_fc
    )
    SELECT 
        ms.ms_muestreo_id,
        ms.ms_fecha_muestreo,
        ms.ms_fecha_muestreo_ts,
        ms.ms_avg_compliance,
        ms.ms_avg_resistencia,
        ms.ms_ensayo_count,
        ms.ms_recipe_code,
        ms.ms_strength_fc,
        ms.ms_concrete_specs
    FROM muestreo_stats ms
    ORDER BY ms.ms_fecha_muestreo DESC;
END;
$function$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_quality_chart_data(date, date, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_chart_data(date, date, uuid, integer) TO anon;
