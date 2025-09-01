-- Migration to standardize concrete_specs in muestreos table
-- Remove resistance/fc information and ensure all muestreos with linked remisiones have age data

-- 1. First, let's see what we currently have in the muestreos table
DO $$
DECLARE
    v_total_muestreos INTEGER;
    v_with_remision INTEGER;
    v_with_concrete_specs INTEGER;
    v_missing_concrete_specs INTEGER;
    v_missing_age_info INTEGER;
BEGIN
    -- Count total muestreos
    SELECT COUNT(*) INTO v_total_muestreos FROM public.muestreos;

    -- Count muestreos with remision_id (linked to remisiones)
    SELECT COUNT(*) INTO v_with_remision
    FROM public.muestreos
    WHERE remision_id IS NOT NULL;

    -- Count muestreos with concrete_specs
    SELECT COUNT(*) INTO v_with_concrete_specs
    FROM public.muestreos
    WHERE concrete_specs IS NOT NULL;

    -- Count muestreos with remision but missing concrete_specs
    SELECT COUNT(*) INTO v_missing_concrete_specs
    FROM public.muestreos
    WHERE remision_id IS NOT NULL AND concrete_specs IS NULL;

    -- Count muestreos with concrete_specs but missing age info
    SELECT COUNT(*) INTO v_missing_age_info
    FROM public.muestreos
    WHERE concrete_specs IS NOT NULL
      AND (concrete_specs->>'valor_edad' IS NULL OR concrete_specs->>'unidad_edad' IS NULL);

    RAISE NOTICE 'Migration Analysis:';
    RAISE NOTICE 'Total muestreos: %', v_total_muestreos;
    RAISE NOTICE 'With remision_id: %', v_with_remision;
    RAISE NOTICE 'With concrete_specs: %', v_with_concrete_specs;
    RAISE NOTICE 'Missing concrete_specs (with remision): %', v_missing_concrete_specs;
    RAISE NOTICE 'Missing age info (with concrete_specs): %', v_missing_age_info;
END $$;

-- 2. Update muestreos that have remision_id but missing concrete_specs
-- Populate with recipe information from linked remision
UPDATE public.muestreos
SET concrete_specs = jsonb_build_object(
    'clasificacion',
    CASE
        WHEN rv.notes ILIKE '%MR%' THEN 'MR'::text
        ELSE 'FC'::text
    END,
    'unidad_edad',
    CASE
        WHEN r.age_hours IS NOT NULL AND r.age_hours > 0 THEN 'HORA'::text
        ELSE 'DÍA'::text
    END,
    'valor_edad',
    CASE
        WHEN r.age_hours IS NOT NULL AND r.age_hours > 0 THEN r.age_hours
        ELSE COALESCE(r.age_days, 28)
    END
)
FROM public.remisiones rem
JOIN public.recipes r ON rem.recipe_id = r.id
LEFT JOIN public.recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
WHERE public.muestreos.remision_id = rem.id
  AND public.muestreos.concrete_specs IS NULL
  AND rem.recipe_id IS NOT NULL;

-- 3. Clean up existing concrete_specs by removing fc/resistance information
UPDATE public.muestreos
SET concrete_specs = concrete_specs - 'fc'
WHERE concrete_specs IS NOT NULL
  AND concrete_specs ? 'fc';

-- 4. For muestreos with concrete_specs but missing age info, populate from recipe
UPDATE public.muestreos
SET concrete_specs = jsonb_build_object(
    'clasificacion', COALESCE(concrete_specs->>'clasificacion',
        CASE
            WHEN rv.notes ILIKE '%MR%' THEN 'MR'::text
            ELSE 'FC'::text
        END),
    'unidad_edad', COALESCE(concrete_specs->>'unidad_edad',
        CASE
            WHEN r.age_hours IS NOT NULL AND r.age_hours > 0 THEN 'HORA'::text
            ELSE 'DÍA'::text
        END),
    'valor_edad', COALESCE((concrete_specs->>'valor_edad')::numeric,
        CASE
            WHEN r.age_hours IS NOT NULL AND r.age_hours > 0 THEN r.age_hours
            ELSE COALESCE(r.age_days, 28)
        END)
)
FROM public.remisiones rem
JOIN public.recipes r ON rem.recipe_id = r.id
LEFT JOIN public.recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
WHERE public.muestreos.remision_id = rem.id
  AND public.muestreos.concrete_specs IS NOT NULL
  AND (public.muestreos.concrete_specs->>'valor_edad' IS NULL
       OR public.muestreos.concrete_specs->>'unidad_edad' IS NULL)
  AND rem.recipe_id IS NOT NULL;

-- 5. Update clasificacion for existing records based on recipe if missing
UPDATE public.muestreos
SET concrete_specs = jsonb_set(
    concrete_specs,
    '{clasificacion}',
    CASE
        WHEN rv.notes ILIKE '%MR%' THEN '"MR"'::jsonb
        ELSE '"FC"'::jsonb
    END
)
FROM public.remisiones rem
JOIN public.recipes r ON rem.recipe_id = r.id
LEFT JOIN public.recipe_versions rv ON r.id = rv.recipe_id AND rv.is_current = true
WHERE public.muestreos.remision_id = rem.id
  AND public.muestreos.concrete_specs IS NOT NULL
  AND (public.muestreos.concrete_specs->>'clasificacion' IS NULL
       OR public.muestreos.concrete_specs->>'clasificacion' = '')
  AND rem.recipe_id IS NOT NULL;

-- 6. Final verification
DO $$
DECLARE
    v_total_muestreos INTEGER;
    v_with_remision INTEGER;
    v_with_concrete_specs INTEGER;
    v_missing_concrete_specs INTEGER;
    v_missing_age_info INTEGER;
    v_with_fc INTEGER;
BEGIN
    -- Count total muestreos
    SELECT COUNT(*) INTO v_total_muestreos FROM public.muestreos;

    -- Count muestreos with remision_id (linked to remisiones)
    SELECT COUNT(*) INTO v_with_remision
    FROM public.muestreos
    WHERE remision_id IS NOT NULL;

    -- Count muestreos with concrete_specs
    SELECT COUNT(*) INTO v_with_concrete_specs
    FROM public.muestreos
    WHERE concrete_specs IS NOT NULL;

    -- Count muestreos with remision but missing concrete_specs
    SELECT COUNT(*) INTO v_missing_concrete_specs
    FROM public.muestreos
    WHERE remision_id IS NOT NULL AND concrete_specs IS NULL;

    -- Count muestreos with concrete_specs but missing age info
    SELECT COUNT(*) INTO v_missing_age_info
    FROM public.muestreos
    WHERE concrete_specs IS NOT NULL
      AND (concrete_specs->>'valor_edad' IS NULL OR concrete_specs->>'unidad_edad' IS NULL);

    -- Count muestreos that still have fc field
    SELECT COUNT(*) INTO v_with_fc
    FROM public.muestreos
    WHERE concrete_specs IS NOT NULL AND concrete_specs ? 'fc';

    RAISE NOTICE 'Migration Results:';
    RAISE NOTICE 'Total muestreos: %', v_total_muestreos;
    RAISE NOTICE 'With remision_id: %', v_with_remision;
    RAISE NOTICE 'With concrete_specs: %', v_with_concrete_specs;
    RAISE NOTICE 'Missing concrete_specs (with remision): %', v_missing_concrete_specs;
    RAISE NOTICE 'Missing age info (with concrete_specs): %', v_missing_age_info;
    RAISE NOTICE 'Still have fc field: %', v_with_fc;

    IF v_missing_concrete_specs = 0 AND v_missing_age_info = 0 AND v_with_fc = 0 THEN
        RAISE NOTICE '✅ Migration completed successfully!';
    ELSE
        RAISE NOTICE '⚠️  Migration completed with some issues that need manual review';
    END IF;
END $$;
