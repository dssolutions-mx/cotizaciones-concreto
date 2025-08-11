-- Add CUBO support and specimen dimensions; update resistance calculations

BEGIN;

-- 1) Extend muestras schema: tipo_muestra allow CUBO and add dimensions
ALTER TABLE public.muestras
  ADD COLUMN IF NOT EXISTS diameter_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS cube_side_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS beam_width_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS beam_height_cm numeric NULL,
  ADD COLUMN IF NOT EXISTS beam_span_cm numeric NULL;

-- Relax and replace check constraint to include CUBO
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' AND t.relname = 'muestras' AND c.conname = 'muestras_tipo_muestra_check'
  ) THEN
    ALTER TABLE public.muestras DROP CONSTRAINT muestras_tipo_muestra_check;
  END IF;
END$$;

ALTER TABLE public.muestras
  ADD CONSTRAINT muestras_tipo_muestra_check
  CHECK (tipo_muestra IN ('CILINDRO','VIGA','CUBO'));

-- 2) Recreate calcular_resistencia with dimension-aware logic
DROP FUNCTION IF EXISTS public.calcular_resistencia(varchar, varchar, numeric);

CREATE OR REPLACE FUNCTION public.calcular_resistencia(
  clasificacion character varying,
  tipo_muestra character varying,
  carga_kg numeric,
  diameter_cm numeric DEFAULT NULL,
  cube_side_cm numeric DEFAULT NULL,
  beam_width_cm numeric DEFAULT NULL,
  beam_height_cm numeric DEFAULT NULL,
  beam_span_cm numeric DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
  resultado NUMERIC := 0;
  area_cm2 NUMERIC := NULL;
BEGIN
  IF tipo_muestra = 'CILINDRO' THEN
    -- default to 15 cm cylinder if not provided
    area_cm2 := CASE WHEN diameter_cm IS NOT NULL AND diameter_cm > 0
                     THEN 3.14159265359 * (diameter_cm/2.0) * (diameter_cm/2.0)
                     ELSE 176.71 END; -- pi * 7.5^2

    IF clasificacion = 'FC' THEN
      resultado := carga_kg / area_cm2;
    ELSIF clasificacion = 'MR' THEN
      -- MR through cylinder (rare): company factor 0.13 over cylinder area
      resultado := 0.13 * (carga_kg / area_cm2);
    END IF;

  ELSIF tipo_muestra = 'CUBO' THEN
    -- Cube compression: carga / side^2 (default 15 cm)
    area_cm2 := CASE WHEN cube_side_cm IS NOT NULL AND cube_side_cm > 0
                     THEN cube_side_cm * cube_side_cm
                     ELSE 225 END; -- 15^2
    resultado := carga_kg / area_cm2;

  ELSIF tipo_muestra = 'VIGA' THEN
    -- Flexural strength. Keep company simplified formula unless dimensions policy is defined
    -- R (kg/cm^2) ≈ 45 * carga / 3375 for standard beam setup
    resultado := 45 * (carga_kg / 3375);
  END IF;

  RETURN COALESCE(resultado, 0);
END;
$$;

-- 3) Update trigger function to pass dimensions to calcular_resistencia
CREATE OR REPLACE FUNCTION public.calculate_resistance_on_ensayo()
RETURNS TRIGGER AS $$
DECLARE
    v_clasificacion VARCHAR;
    v_tipo_muestra VARCHAR;
    v_resistencia_diseno NUMERIC;
    v_edad_garantia INTEGER;
    v_fecha_muestreo DATE;
    v_edad_ensayo INTEGER;
    v_resistencia_calculada NUMERIC;
    v_porcentaje_cumplimiento NUMERIC;
    v_diameter_cm NUMERIC;
    v_cube_side_cm NUMERIC;
    v_beam_w NUMERIC;
    v_beam_h NUMERIC;
    v_beam_span NUMERIC;
BEGIN
    -- Get sample type, dimensions and muestreo date
    SELECT 
        m.tipo_muestra,
        mu.fecha_muestreo,
        m.diameter_cm,
        m.cube_side_cm,
        m.beam_width_cm,
        m.beam_height_cm,
        m.beam_span_cm
    INTO v_tipo_muestra, v_fecha_muestreo, v_diameter_cm, v_cube_side_cm, v_beam_w, v_beam_h, v_beam_span
    FROM muestras m
    JOIN muestreos mu ON m.muestreo_id = mu.id
    WHERE m.id = NEW.muestra_id;
    
    -- Get recipe details (classification, strength, age)
    SELECT 
        CASE WHEN rv.notes ILIKE '%MR%' THEN 'MR' ELSE 'FC' END AS clasificacion,
        r.strength_fc,
        r.age_days INTO v_clasificacion, v_resistencia_diseno, v_edad_garantia
    FROM muestreos mu
    JOIN remisiones rem ON mu.remision_id = rem.id
    JOIN recipes r ON rem.recipe_id = r.id
    JOIN recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
    WHERE mu.id = (
        SELECT muestreo_id FROM muestras WHERE id = NEW.muestra_id
    );
    
    -- Calculate age of test in days
    v_edad_ensayo := NEW.fecha_ensayo - v_fecha_muestreo;
    
    -- Calculate resistance (dimension-aware)
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
    
    -- Calculate compliance percentage
    SELECT public.calcular_porcentaje_cumplimiento(
        v_resistencia_calculada,
        v_resistencia_diseno,
        v_edad_ensayo,
        v_edad_garantia
    ) INTO v_porcentaje_cumplimiento;
    
    -- Update the ensayo record with calculated values
    NEW.resistencia_calculada := v_resistencia_calculada;
    NEW.porcentaje_cumplimiento := v_porcentaje_cumplimiento;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;


