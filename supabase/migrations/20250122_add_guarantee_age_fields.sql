-- Add guarantee age fields to muestras and ensayos tables
-- Migration: 20250122_add_guarantee_age_fields.sql

-- Add is_edad_garantia column to muestras table
ALTER TABLE public.muestras
ADD COLUMN is_edad_garantia BOOLEAN;

-- Add is_edad_garantia and is_ensayo_fuera_tiempo columns to ensayos table
ALTER TABLE public.ensayos
ADD COLUMN is_edad_garantia BOOLEAN,
ADD COLUMN is_ensayo_fuera_tiempo BOOLEAN;

-- Add comments to document the purpose of these fields
COMMENT ON COLUMN public.muestras.is_edad_garantia IS 'Indicates if the sample was scheduled for testing at guarantee age';
COMMENT ON COLUMN public.ensayos.is_edad_garantia IS 'Indicates if the test was performed at guarantee age';
COMMENT ON COLUMN public.ensayos.is_ensayo_fuera_tiempo IS 'Indicates if the test was performed outside the guarantee age window (only applies when is_edad_garantia is true)';

-- Create index for performance on the new boolean fields
CREATE INDEX idx_muestras_is_edad_garantia ON public.muestras(is_edad_garantia);
CREATE INDEX idx_ensayos_is_edad_garantia ON public.ensayos(is_edad_garantia);
CREATE INDEX idx_ensayos_is_ensayo_fuera_tiempo ON public.ensayos(is_ensayo_fuera_tiempo);
