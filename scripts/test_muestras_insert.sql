-- Test script to verify muestras INSERT operation works after fixing plant_id field
-- This tests the real issue: missing plant_id in frontend service

-- 1. Check current user's profile and plant assignment
SELECT 
    up.id as user_id,
    up.email,
    up.role,
    up.plant_id as user_plant_id,
    p.code as plant_code,
    p.name as plant_name
FROM user_profiles up 
LEFT JOIN plants p ON p.id = up.plant_id
WHERE up.id = auth.uid();

-- 2. Check available muestreos for testing
SELECT 
    id as muestreo_id,
    planta,
    plant_id,
    fecha_muestreo,
    created_by
FROM public.muestreos 
WHERE plant_id IS NOT NULL
LIMIT 3;

-- 3. Test INSERT operation with plant_id (simulating fixed frontend)
-- Replace 'your-muestreo-id-here' with an actual muestreo_id from step 2
-- Replace 'your-plant-id-here' with the plant_id from that muestreo
/*
INSERT INTO public.muestras (
    muestreo_id,
    plant_id,  -- ← This field was missing and caused the 403 error!
    tipo_muestra,
    identificacion,
    fecha_programada_ensayo,
    estado,
    created_at
) VALUES (
    'your-muestreo-id-here'::uuid,
    'your-plant-id-here'::uuid,  -- ← Must match user's plant_id for RLS policy
    'CILINDRO',
    'TEST-INSERT-FIXED-001',
    CURRENT_DATE,
    'PENDIENTE',
    NOW()
) RETURNING id, identificacion, estado, plant_id;

-- Clean up test data
-- DELETE FROM public.muestras WHERE identificacion = 'TEST-INSERT-FIXED-001';
*/

-- 4. Verify RLS policy is working correctly
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: Yes'
        ELSE 'WITH CHECK: No'
    END as insert_policy
FROM pg_policies 
WHERE tablename = 'muestras'
ORDER BY policyname;

-- 5. Check if the fix is applied in the frontend
-- The qualityService.ts should now include:
-- plant_id: muestreo.plant_id
-- in the addSampleToMuestreo function
