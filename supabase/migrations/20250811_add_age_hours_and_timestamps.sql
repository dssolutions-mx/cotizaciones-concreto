-- Add hour-based age support and timestamp scheduling for quality module
-- Safe, additive migration: keeps existing date-based columns for compatibility

BEGIN;

-- 1) Recipes: add optional age_hours. Keep age_days for backward-compat.
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS age_hours integer;

-- Optional: backfill age_hours from age_days when missing
UPDATE public.recipes
SET age_hours = age_days * 24
WHERE age_hours IS NULL AND age_days IS NOT NULL;

-- 2) Muestreos/Muestras/Ensayos: add timestamp columns to support sub-day scheduling
ALTER TABLE public.muestreos
  ADD COLUMN IF NOT EXISTS fecha_muestreo_ts timestamptz;

ALTER TABLE public.muestras
  ADD COLUMN IF NOT EXISTS fecha_programada_ensayo_ts timestamptz;

ALTER TABLE public.ensayos
  ADD COLUMN IF NOT EXISTS fecha_ensayo_ts timestamptz;

-- Backfill TS columns at 12:00 local time to avoid timezone drift
UPDATE public.muestreos
SET fecha_muestreo_ts = (fecha_muestreo::timestamptz + time '12:00')
WHERE fecha_muestreo IS NOT NULL AND fecha_muestreo_ts IS NULL;

UPDATE public.muestras
SET fecha_programada_ensayo_ts = (fecha_programada_ensayo::timestamptz + time '12:00')
WHERE fecha_programada_ensayo IS NOT NULL AND fecha_programada_ensayo_ts IS NULL;

UPDATE public.ensayos
SET fecha_ensayo_ts = (fecha_ensayo::timestamptz + time '12:00')
WHERE fecha_ensayo IS NOT NULL AND fecha_ensayo_ts IS NULL;

-- 3) Age-based compliance by hours (new helper). Falls back to ratio if not a standard curve.
CREATE OR REPLACE FUNCTION public.calcular_porcentaje_cumplimiento_horas(
  resistencia_calculada numeric,
  resistencia_diseno numeric,
  edad_ensayo_horas integer,
  edad_garantia_horas integer
) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  factor_edad NUMERIC := 1.0;
  edad_ensayo_dias NUMERIC := NULL;
  edad_garantia_dias NUMERIC := NULL;
BEGIN
  IF resistencia_diseno IS NULL OR resistencia_diseno = 0 THEN
    RETURN 0;
  END IF;

  IF edad_ensayo_horas IS NULL OR edad_garantia_horas IS NULL OR edad_garantia_horas <= 0 THEN
    RETURN (resistencia_calculada / resistencia_diseno) * 100;
  END IF;

  edad_ensayo_dias := edad_ensayo_horas / 24.0;
  edad_garantia_dias := edad_garantia_horas / 24.0;

  -- If both map to common day checkpoints use the existing day-based function
  IF edad_ensayo_dias = round(edad_ensayo_dias) AND edad_garantia_dias = round(edad_garantia_dias) THEN
    RETURN public.calcular_porcentaje_cumplimiento(
      resistencia_calculada,
      resistencia_diseno,
      edad_ensayo_dias::integer,
      edad_garantia_dias::integer
    );
  END IF;

  -- Generic proportional factor as safe default
  factor_edad := LEAST(edad_ensayo_dias / NULLIF(edad_garantia_dias, 0), 1.0);
  RETURN (resistencia_calculada / (resistencia_diseno * NULLIF(factor_edad, 0))) * 100;
END;
$$;

-- 4) Update trigger to compute age and compliance using hours when possible
CREATE OR REPLACE FUNCTION public.calculate_resistance_on_ensayo()
RETURNS TRIGGER AS $$
DECLARE
    v_clasificacion VARCHAR;
    v_tipo_muestra VARCHAR;
    v_resistencia_diseno NUMERIC;
    v_edad_garantia_dias INTEGER;
    v_edad_garantia_horas INTEGER;
    v_fecha_muestreo_ts timestamptz;
    v_edad_ensayo_horas INTEGER := NULL;
    v_resistencia_calculada NUMERIC;
    v_porcentaje_cumplimiento NUMERIC;
    v_diameter_cm NUMERIC;
    v_cube_side_cm NUMERIC;
    v_beam_w NUMERIC;
    v_beam_h NUMERIC;
    v_beam_span NUMERIC;
BEGIN
    -- Sample type, dimensions, and sampling timestamp
    SELECT 
        m.tipo_muestra,
        mu.fecha_muestreo_ts,
        m.diameter_cm,
        m.cube_side_cm,
        m.beam_width_cm,
        m.beam_height_cm,
        m.beam_span_cm
    INTO v_tipo_muestra, v_fecha_muestreo_ts, v_diameter_cm, v_cube_side_cm, v_beam_w, v_beam_h, v_beam_span
    FROM muestras m
    JOIN muestreos mu ON m.muestreo_id = mu.id
    WHERE m.id = NEW.muestra_id;

    -- Recipe details (classification, strength, age)
    SELECT 
        CASE WHEN rv.notes ILIKE '%MR%' THEN 'MR' ELSE 'FC' END AS clasificacion,
        r.strength_fc,
        r.age_days
    INTO v_clasificacion, v_resistencia_diseno, v_edad_garantia_dias
    FROM muestreos mu
    JOIN remisiones rem ON mu.remision_id = rem.id
    JOIN recipes r ON rem.recipe_id = r.id
    JOIN recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
    WHERE mu.id = (
        SELECT muestreo_id FROM muestras WHERE id = NEW.muestra_id
    );

    -- Compute guarantee age in hours (prefer recipes.age_hours if present)
    SELECT COALESCE(r.age_hours, r.age_days * 24)
    INTO v_edad_garantia_horas
    FROM muestreos mu
    JOIN remisiones rem ON mu.remision_id = rem.id
    JOIN recipes r ON rem.recipe_id = r.id
    WHERE mu.id = (
        SELECT muestreo_id FROM muestras WHERE id = NEW.muestra_id
    );

    -- Compute test age in hours using timestamps when possible
    IF NEW.fecha_ensayo_ts IS NOT NULL AND v_fecha_muestreo_ts IS NOT NULL THEN
      v_edad_ensayo_horas := FLOOR(EXTRACT(EPOCH FROM (NEW.fecha_ensayo_ts - v_fecha_muestreo_ts)) / 3600);
    ELSIF NEW.fecha_ensayo IS NOT NULL THEN
      -- Fallback to date difference in days * 24
      v_edad_ensayo_horas := ((NEW.fecha_ensayo - (v_fecha_muestreo_ts::date)) * 24);
    END IF;

    -- Dimension-aware resistance
    SELECT public.calcular_resistencia(
        v_clasificacion,
        v_tipo_muestra,
        NEW.carga_kg,
        v_diameter_cm,
        v_cube_side_cm,
        v_beam_w,
        v_beam_h,
        v_beam_span
    ) INTO v_resistencia_calculada;

    -- Compliance percentage (hours-aware when possible)
    IF v_edad_ensayo_horas IS NOT NULL AND v_edad_garantia_horas IS NOT NULL THEN
      SELECT public.calcular_porcentaje_cumplimiento_horas(
        v_resistencia_calculada,
        v_resistencia_diseno,
        v_edad_ensayo_horas,
        v_edad_garantia_horas
      ) INTO v_porcentaje_cumplimiento;
    ELSE
      -- Fallback to existing days-based function
      SELECT public.calcular_porcentaje_cumplimiento(
        v_resistencia_calculada,
        v_resistencia_diseno,
        GREATEST(0, (NEW.fecha_ensayo - (v_fecha_muestreo_ts::date))::int),
        v_edad_garantia_dias
      ) INTO v_porcentaje_cumplimiento;
    END IF;

    NEW.resistencia_calculada := v_resistencia_calculada;
    NEW.porcentaje_cumplimiento := v_porcentaje_cumplimiento;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5) Update metrics RPC to respect hour-based guarantee when available
CREATE OR REPLACE FUNCTION public.calcular_metricas_muestreo(p_muestreo_id uuid)
RETURNS TABLE(
  volumen_real numeric,
  rendimiento_volumetrico numeric,
  consumo_cemento_real numeric,
  eficiencia numeric
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_remision_id UUID;
    v_masa_unitaria NUMERIC;
    v_volumen_registrado NUMERIC;
    v_suma_materiales NUMERIC := 0;
    v_kg_cemento NUMERIC := 0;
    v_resistencia NUMERIC := 0;
    v_clasificacion VARCHAR;
    v_recipe_id UUID;
    v_fecha_muestreo_ts timestamptz;
    v_edad_horas INTEGER;
BEGIN
    SELECT m.remision_id, m.masa_unitaria, m.fecha_muestreo_ts
    INTO v_remision_id, v_masa_unitaria, v_fecha_muestreo_ts
    FROM muestreos m
    WHERE m.id = p_muestreo_id;

    SELECT r.volumen_fabricado, r.recipe_id
    INTO v_volumen_registrado, v_recipe_id
    FROM remisiones r
    WHERE r.id = v_remision_id;

    SELECT CASE WHEN notes ILIKE '%MR%' THEN 'MR' ELSE 'FC' END 
    INTO v_clasificacion
    FROM recipe_versions
    WHERE recipe_id = v_recipe_id AND is_current = true;

    SELECT COALESCE(SUM(cantidad_real), 0) INTO v_suma_materiales
    FROM remision_materiales
    WHERE remision_id = v_remision_id;

    SELECT COALESCE(cantidad_real, 0) INTO v_kg_cemento
    FROM remision_materiales
    WHERE remision_id = v_remision_id AND material_type = 'cement';

    volumen_real := CASE WHEN v_masa_unitaria > 0 THEN v_suma_materiales / v_masa_unitaria ELSE 0 END;
    rendimiento_volumetrico := CASE WHEN v_volumen_registrado > 0 AND volumen_real > 0 THEN volumen_real / v_volumen_registrado * 100 ELSE 0 END;
    consumo_cemento_real := CASE WHEN volumen_real > 0 THEN v_kg_cemento / volumen_real ELSE 0 END;

    -- Compute average resistencia at guarantee age (by hours if available)
    SELECT COALESCE(r.age_hours, r.age_days * 24) INTO v_edad_horas
    FROM recipes r WHERE r.id = v_recipe_id;

    SELECT COALESCE(AVG(e.resistencia_calculada), 0) INTO v_resistencia
    FROM ensayos e
    JOIN muestras muest ON e.muestra_id = muest.id
    WHERE muest.muestreo_id = p_muestreo_id
      AND muest.estado = 'ENSAYADO'
      AND (
        (muest.fecha_programada_ensayo_ts IS NOT NULL AND v_fecha_muestreo_ts IS NOT NULL AND muest.fecha_programada_ensayo_ts = v_fecha_muestreo_ts + (v_edad_horas || ' hours')::interval)
        OR
        (muest.fecha_programada_ensayo_ts IS NULL AND v_fecha_muestreo_ts IS NULL AND muest.fecha_programada_ensayo = (SELECT fecha_muestreo + r.age_days FROM muestreos m2 JOIN remisiones rem2 ON m2.remision_id = rem2.id JOIN recipes r ON rem2.recipe_id = r.id WHERE m2.id = p_muestreo_id))
      );

    IF consumo_cemento_real > 0 THEN
      IF v_clasificacion = 'MR' THEN
        eficiencia := (v_resistencia / 0.13) / consumo_cemento_real;
      ELSE
        eficiencia := v_resistencia / consumo_cemento_real;
      END IF;
    ELSE
      eficiencia := 0;
    END IF;

    RETURN NEXT;
END;
$function$;

-- 6) Extend spec functions to include age_hours (optional). Add parameter at end to preserve existing calls.
CREATE OR REPLACE FUNCTION public.find_recipes_by_specifications(
  p_strength_fc numeric DEFAULT NULL,
  p_age_days integer DEFAULT NULL,
  p_placement_type character varying DEFAULT NULL,
  p_max_aggregate_size numeric DEFAULT NULL,
  p_slump numeric DEFAULT NULL,
  p_application_type character varying DEFAULT NULL,
  p_has_waterproofing boolean DEFAULT NULL,
  p_performance_grade character varying DEFAULT NULL,
  p_plant_id uuid DEFAULT NULL,
  p_recipe_type character varying DEFAULT NULL,
  p_age_hours integer DEFAULT NULL
)
RETURNS TABLE(
  recipe_id uuid,
  recipe_code character varying,
  new_system_code character varying,
  coding_system character varying,
  current_version_number integer,
  total_versions bigint,
  application_type character varying,
  has_waterproofing boolean,
  performance_grade character varying,
  recipe_type character varying,
  strength_fc numeric,
  age_days integer,
  age_hours integer,
  placement_type character varying,
  max_aggregate_size numeric,
  slump numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id::UUID as recipe_id,
    r.recipe_code::VARCHAR,
    r.new_system_code::VARCHAR,
    r.coding_system::VARCHAR,
    COALESCE(rv.version_number, 1)::INTEGER as current_version_number,
    1::BIGINT as total_versions,
    r.application_type::VARCHAR,
    r.has_waterproofing::BOOLEAN,
    r.performance_grade::VARCHAR,
    COALESCE(rv.notes, '')::VARCHAR as recipe_type,
    r.strength_fc::NUMERIC,
    r.age_days::INTEGER,
    r.age_hours::INTEGER,
    r.placement_type::VARCHAR,
    r.max_aggregate_size::NUMERIC,
    r.slump::NUMERIC
  FROM recipes r
  LEFT JOIN recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
  WHERE 
    (p_strength_fc IS NULL OR r.strength_fc = p_strength_fc)
    AND (p_age_days IS NULL OR r.age_days = p_age_days)
    AND (p_age_hours IS NULL OR r.age_hours = p_age_hours)
    AND (p_placement_type IS NULL OR r.placement_type = p_placement_type)
    AND (p_max_aggregate_size IS NULL OR r.max_aggregate_size = p_max_aggregate_size)
    AND (p_slump IS NULL OR r.slump = p_slump)
    AND (p_application_type IS NULL OR r.application_type = p_application_type)
    AND (p_has_waterproofing IS NULL OR r.has_waterproofing = p_has_waterproofing)
    AND (p_performance_grade IS NULL OR r.performance_grade = p_performance_grade)
    AND (p_plant_id IS NULL OR r.plant_id = p_plant_id)
    AND (p_recipe_type IS NULL OR (rv.notes IS NOT NULL AND rv.notes ILIKE '%' || p_recipe_type || '%'))
  ORDER BY r.recipe_code;
END;
$$;

-- create_recipe_with_specifications: add p_age_hours at end, optional
CREATE OR REPLACE FUNCTION public.create_recipe_with_specifications(
  p_age_days integer,
  p_materials jsonb,
  p_max_aggregate_size numeric,
  p_placement_type character varying,
  p_plant_id uuid,
  p_recipe_code character varying,
  p_slump numeric,
  p_strength_fc numeric,
  p_application_type character varying DEFAULT 'standard',
  p_has_waterproofing boolean DEFAULT false,
  p_new_system_code character varying DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_performance_grade character varying DEFAULT 'standard',
  p_recipe_type character varying DEFAULT NULL,
  p_age_hours integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  recipe_id UUID;
  version_id UUID;
  material_record JSONB;
BEGIN
  INSERT INTO recipes (
    recipe_code,
    new_system_code,
    strength_fc,
    age_days,
    age_hours,
    placement_type,
    max_aggregate_size,
    slump,
    application_type,
    has_waterproofing,
    performance_grade,
    plant_id,
    coding_system
  )
  VALUES (
    p_recipe_code,
    p_new_system_code,
    p_strength_fc,
    p_age_days,
    p_age_hours,
    p_placement_type,
    p_max_aggregate_size,
    p_slump,
    p_application_type,
    p_has_waterproofing,
    p_performance_grade,
    p_plant_id,
    CASE WHEN p_new_system_code IS NOT NULL THEN 'new_system' ELSE 'legacy' END
  )
  RETURNING id INTO recipe_id;

  INSERT INTO recipe_versions (recipe_id, version_number, effective_date, is_current, notes)
  VALUES (recipe_id, 1, now(), true, p_recipe_type)
  RETURNING id INTO version_id;

  IF p_materials IS NOT NULL THEN
    FOR material_record IN SELECT * FROM jsonb_array_elements(p_materials)
    LOOP
      INSERT INTO material_quantities (
        recipe_version_id, material_id, material_type, quantity, unit
      )
      SELECT 
        version_id,
        (material_record->>'material_id')::UUID,
        COALESCE(m.material_code, material_record->>'material_type'),
        (material_record->>'quantity')::NUMERIC,
        material_record->>'unit'
      FROM materials m 
      WHERE m.id = (material_record->>'material_id')::UUID
      UNION ALL
      SELECT 
        version_id,
        NULL,
        material_record->>'material_type',
        (material_record->>'quantity')::NUMERIC,
        material_record->>'unit'
      WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.id = (material_record->>'material_id')::UUID);
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'recipe_id', recipe_id,
    'version_id', version_id,
    'recipe_code', p_recipe_code,
    'new_system_code', p_new_system_code,
    'version_number', 1,
    'application_type', p_application_type,
    'has_waterproofing', p_has_waterproofing,
    'performance_grade', p_performance_grade,
    'recipe_type', p_recipe_type,
    'age_days', p_age_days,
    'age_hours', p_age_hours
  );
END;
$$;

COMMIT;


