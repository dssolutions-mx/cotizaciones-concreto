-- CORRECCIÓN FINAL PLANTA 2
-- Ajusta tipos de muestra basado en análisis de cargas
-- Generado: 2025-08-17 23:55:39

-- CORRECCIONES IDENTIFICADAS:
-- Remisión 7942 M1: CUBO 10x10
-- Remisión 7942 M2: CUBO 10x10
-- Remisión 8005 M3: CUBO 15x15
-- Remisión 8013 M2: CUBO 10x10
-- Remisión 8103 M1: CUBO 15x15
-- Remisión 8103 M2: CUBO 15x15
-- Remisión 8115 M1: CUBO 15x15
-- Remisión 8171 M1: CUBO 10x10
-- Remisión 8171 M2: CUBO 10x10
-- Remisión 8200 M2: CUBO 10x10
-- Remisión 8308 M1: CUBO 10x10
-- Remisión 8308 M2: CUBO 10x10
-- Remisión 8308 M1: CUBO 10x10
-- Remisión 8531 M1: CUBO 10x10

BEGIN;

-- Corregir Remisión 7942 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '7942' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 7942 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '7942' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8005 - Muestra 3
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8005' AND planta = 'P2'
) AND identificacion = 'M3';

-- Corregir Remisión 8013 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8013' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8103 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8103' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 8103 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8103' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8115 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8115' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 8171 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8171' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 8171 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8171' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8200 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8200' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8308 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8308' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 8308 - Muestra 2
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8308' AND planta = 'P2'
) AND identificacion = 'M2';

-- Corregir Remisión 8308 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8308' AND planta = 'P2'
) AND identificacion = 'M1';

-- Corregir Remisión 8531 - Muestra 1
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8531' AND planta = 'P2'
) AND identificacion = 'M1';

COMMIT;

-- VERIFICACIÓN POST-CORRECCIÓN
SELECT 
  m.manual_reference as remision,
  mu.identificacion,
  mu.tipo_muestra,
  mu.cube_side_cm,
  e.carga_kg,
  CASE 
    WHEN mu.tipo_muestra = 'CUBO' AND mu.cube_side_cm = 10 AND e.carga_kg BETWEEN 20000 AND 80000 THEN '✅ OK'
    WHEN mu.tipo_muestra = 'CUBO' AND mu.cube_side_cm = 15 AND e.carga_kg BETWEEN 60000 AND 150000 THEN '✅ OK'
    WHEN mu.tipo_muestra = 'VIGA' AND e.carga_kg BETWEEN 1000 AND 5000 THEN '✅ OK'
    ELSE '⚠️ REVISAR'
  END as estado_validacion
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
LEFT JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.planta = 'P2' AND e.carga_kg IS NOT NULL
ORDER BY m.manual_reference::int, mu.identificacion;
