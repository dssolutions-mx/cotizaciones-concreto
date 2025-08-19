-- Test script to verify muestras INSERT operation works after RLS policy fix
-- Run this after applying the migration: 20250119_fix_muestras_rls_policies.sql

-- 1. Check if RLS policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
        ELSE 'No WITH CHECK'
    END as insert_policy
FROM pg_policies 
WHERE tablename IN ('muestras', 'muestreos', 'ensayos')
ORDER BY tablename, policyname;

-- 2. Check current user role
SELECT 
    auth.uid() as current_user_id,
    up.role as user_role,
    up.email as user_email
FROM user_profiles up 
WHERE up.id = auth.uid();

-- 3. Test if we can read from muestras table
SELECT COUNT(*) as total_muestras FROM public.muestras LIMIT 1;

-- 4. Test if we can read from muestreos table (to get a valid muestreo_id)
SELECT 
    id as muestreo_id,
    fecha_muestreo,
    planta
FROM public.muestreos 
LIMIT 1;

-- 5. Test INSERT operation (uncomment and modify muestreo_id as needed)
/*
-- Replace 'your-muestreo-id-here' with an actual muestreo_id from step 4
INSERT INTO public.muestras (
    muestreo_id,
    tipo_muestra,
    identificacion,
    fecha_programada_ensayo,
    estado,
    created_at
) VALUES (
    'your-muestreo-id-here'::uuid,
    'CILINDRO',
    'TEST-INSERT-001',
    CURRENT_DATE,
    'PENDIENTE',
    NOW()
) RETURNING id, identificacion, estado;

-- Clean up test data
-- DELETE FROM public.muestras WHERE identificacion = 'TEST-INSERT-001';
*/

-- 6. Check RLS status on quality tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('muestras', 'muestreos', 'ensayos', 'evidencias', 'alertas_ensayos')
ORDER BY tablename;

-- 7. Verify permissions for authenticated role
SELECT 
    table_name,
    privilege_type,
    is_grantable
FROM information_schema.role_table_grants 
WHERE grantee = 'authenticated' 
    AND table_name IN ('muestras', 'muestreos', 'ensayos')
ORDER BY table_name, privilege_type;
