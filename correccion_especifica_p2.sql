-- CORRECCIONES ESPECÍFICAS PARA PLANTA 2
-- Corrige tipos de muestra basado en análisis de cargas
-- Generado: 2025-08-17 23:55:04

-- NOTA: Estas correcciones asumen que las CARGAS son correctas
-- y que los TIPOS DE MUESTRA fueron mal capturados

-- Remisión 7942 - Muestra 2
-- Problema: Carga 48700.0 kg es demasiado baja para CUBO 15x15 (min 60k). Debería ser CUBO 10x10
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 10
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '7942' AND planta = 'P2'
) AND identificacion = 'M2';

-- Remisión 8005 - Muestra 3
-- Problema: Carga 99151.0 kg es demasiado alta para CUBO 10x10 (max 80k). Debería ser CUBO 15x15
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8005' AND planta = 'P2'
) AND identificacion = 'M3';

-- Remisión 8103 - Muestra 1
-- Problema: Carga 94507.0 kg es demasiado alta para CUBO 10x10 (max 80k). Debería ser CUBO 15x15
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8103' AND planta = 'P2'
) AND identificacion = 'M1';

-- Remisión 8103 - Muestra 2
-- Problema: Carga 94507.0 kg es demasiado alta para CUBO 10x10 (max 80k). Debería ser CUBO 15x15
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8103' AND planta = 'P2'
) AND identificacion = 'M2';

-- Remisión 8115 - Muestra 1
-- Problema: Carga 119943.0 kg es demasiado alta para CUBO 10x10 (max 80k). Debería ser CUBO 15x15
UPDATE public.muestras 
SET tipo_muestra = 'CUBO', cube_side_cm = 15
WHERE muestreo_id IN (
    SELECT id FROM public.muestreos 
    WHERE manual_reference = '8115' AND planta = 'P2'
) AND identificacion = 'M1';

-- Remisión 8124 - Muestra 2
-- Problema: Carga 458733.0 kg es demasiado alta para CUBO 10x10 (max 80k). Debería ser CUBO 15x15
-- VERIFICACIÓN FINAL
SELECT 
  m.manual_reference as remision,
  mu.identificacion,
  mu.tipo_muestra,
  mu.cube_side_cm,
  e.carga_kg,
  CASE 
    WHEN mu.tipo_muestra = 'CUBO' AND mu.cube_side_cm = 10 AND (e.carga_kg < 20000 OR e.carga_kg > 80000) THEN 'INCONSISTENTE'
    WHEN mu.tipo_muestra = 'CUBO' AND mu.cube_side_cm = 15 AND (e.carga_kg < 60000 OR e.carga_kg > 150000) THEN 'INCONSISTENTE'
    WHEN mu.tipo_muestra = 'VIGA' AND e.carga_kg > 5000 THEN 'INCONSISTENTE'
    ELSE 'OK'
  END as validacion
FROM public.muestreos m
JOIN public.muestras mu ON mu.muestreo_id = m.id
LEFT JOIN public.ensayos e ON e.muestra_id = mu.id
WHERE m.planta = 'P2' AND e.carga_kg IS NOT NULL
ORDER BY m.manual_reference::int, mu.identificacion;
