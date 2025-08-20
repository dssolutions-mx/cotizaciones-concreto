-- Fix RLS policies for quality module tables
-- This migration addresses the 403 Forbidden error when trying to insert into muestras table

-- 1. Enable RLS on quality tables if not already enabled
ALTER TABLE IF EXISTS public.muestreos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.muestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ensayos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.evidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.alertas_ensayos ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.muestreos;
DROP POLICY IF EXISTS "Permitir creación a equipo de calidad" ON public.muestreos;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.muestras;
DROP POLICY IF EXISTS "Permitir creación a equipo de calidad" ON public.muestras;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.ensayos;
DROP POLICY IF EXISTS "Permitir creación a equipo de calidad" ON public.ensayos;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.evidencias;
DROP POLICY IF EXISTS "Permitir creación a equipo de calidad" ON public.evidencias;
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.alertas_ensayos;
DROP POLICY IF EXISTS "Permitir creación a equipo de calidad" ON public.alertas_ensayos;

-- 3. Create comprehensive RLS policies for all quality tables

-- MUESTREOS table policies
CREATE POLICY "muestreos_select_policy" ON public.muestreos
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "muestreos_insert_policy" ON public.muestreos
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

CREATE POLICY "muestreos_update_policy" ON public.muestreos
FOR UPDATE TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

-- MUESTRAS table policies
CREATE POLICY "muestras_select_policy" ON public.muestras
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "muestras_insert_policy" ON public.muestras
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

CREATE POLICY "muestras_update_policy" ON public.muestras
FOR UPDATE TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

-- ENSAYOS table policies
CREATE POLICY "ensayos_select_policy" ON public.ensayos
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "ensayos_insert_policy" ON public.ensayos
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

CREATE POLICY "ensayos_update_policy" ON public.ensayos
FOR UPDATE TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

-- EVIDENCIAS table policies
CREATE POLICY "evidencias_select_policy" ON public.evidencias
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "evidencias_insert_policy" ON public.evidencias
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

CREATE POLICY "evidencias_update_policy" ON public.evidencias
FOR UPDATE TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

-- ALERTAS_ENSAYOS table policies
CREATE POLICY "alertas_ensayos_select_policy" ON public.alertas_ensayos
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "alertas_ensayos_insert_policy" ON public.alertas_ensayos
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

CREATE POLICY "alertas_ensayos_update_policy" ON public.alertas_ensayos
FOR UPDATE TO authenticated
USING (
    auth.uid() IN (
        SELECT id FROM user_profiles 
        WHERE role IN ('QUALITY_TEAM', 'EXECUTIVE', 'PLANT_MANAGER', 'LABORATORY')
    )
);

-- 4. Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.muestreos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.muestras TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ensayos TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.evidencias TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.alertas_ensayos TO authenticated;

-- 5. Verify policies were created
DO $$
BEGIN
    RAISE NOTICE 'RLS policies created for quality module tables';
    RAISE NOTICE 'Users with QUALITY_TEAM, EXECUTIVE, PLANT_MANAGER, or LABORATORY roles can now insert/update muestras';
END $$;
