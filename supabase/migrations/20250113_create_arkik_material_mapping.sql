-- Create arkik_material_mapping table for dynamic material code mapping per plant
-- Based on arkik-processor-implementation.md requirements

BEGIN;

-- Create the mapping table
CREATE TABLE IF NOT EXISTS public.arkik_material_mapping (
  plant_id uuid NOT NULL REFERENCES public.plants(id) ON DELETE CASCADE,
  arkik_code text NOT NULL,
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  notes text,
  
  PRIMARY KEY (plant_id, arkik_code)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS arkik_material_mapping_plant_id_idx ON public.arkik_material_mapping (plant_id);
CREATE INDEX IF NOT EXISTS arkik_material_mapping_material_id_idx ON public.arkik_material_mapping (material_id);
CREATE INDEX IF NOT EXISTS arkik_material_mapping_arkik_code_idx ON public.arkik_material_mapping (arkik_code);

-- RLS
ALTER TABLE public.arkik_material_mapping ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS arkik_material_mapping_select ON public.arkik_material_mapping;
CREATE POLICY arkik_material_mapping_select ON public.arkik_material_mapping
  FOR SELECT TO authenticated
  USING (true); -- Read access for all authenticated users

DROP POLICY IF EXISTS arkik_material_mapping_insert ON public.arkik_material_mapping;
CREATE POLICY arkik_material_mapping_insert ON public.arkik_material_mapping
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('PLANT_MANAGER', 'ADMIN', 'EXECUTIVE')
    )
  );

DROP POLICY IF EXISTS arkik_material_mapping_update ON public.arkik_material_mapping;
CREATE POLICY arkik_material_mapping_update ON public.arkik_material_mapping
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('PLANT_MANAGER', 'ADMIN', 'EXECUTIVE')
    )
  );

DROP POLICY IF EXISTS arkik_material_mapping_delete ON public.arkik_material_mapping;
CREATE POLICY arkik_material_mapping_delete ON public.arkik_material_mapping
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('PLANT_MANAGER', 'ADMIN', 'EXECUTIVE')
    )
  );

-- Add comments for documentation
COMMENT ON TABLE public.arkik_material_mapping IS 'Maps Arkik material codes to internal material IDs per plant. Enables dynamic material detection from Excel imports.';
COMMENT ON COLUMN public.arkik_material_mapping.plant_id IS 'Plant where this mapping applies';
COMMENT ON COLUMN public.arkik_material_mapping.arkik_code IS 'Material code as it appears in Arkik Excel exports (e.g., A1, C1, AR2)';
COMMENT ON COLUMN public.arkik_material_mapping.material_id IS 'Reference to the master material record in materials table';
COMMENT ON COLUMN public.arkik_material_mapping.notes IS 'Optional notes about this mapping';

-- Function to get mapped material codes for a plant
CREATE OR REPLACE FUNCTION public.get_arkik_material_mappings(p_plant_id uuid)
RETURNS TABLE (
  arkik_code text,
  material_id uuid,
  material_code varchar,
  material_name varchar,
  category varchar,
  unit_of_measure varchar
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    amm.arkik_code,
    amm.material_id,
    m.material_code,
    m.material_name,
    m.category,
    m.unit_of_measure
  FROM public.arkik_material_mapping amm
  JOIN public.materials m ON m.id = amm.material_id
  WHERE amm.plant_id = p_plant_id
    AND m.is_active = true
  ORDER BY amm.arkik_code;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_arkik_material_mappings TO authenticated;

-- Example initial mappings for common materials (can be customized per plant)
-- These are just examples and should be configured per plant's actual material setup
INSERT INTO public.arkik_material_mapping (plant_id, arkik_code, material_id, notes)
SELECT 
  p.id as plant_id,
  codes.arkik_code,
  m.id as material_id,
  'Auto-generated initial mapping' as notes
FROM public.plants p
CROSS JOIN (
  VALUES
    ('A1', 'AGUA'),
    ('C1', 'CEMENTO'),
    ('AR1', 'ARENA'),
    ('AR2', 'ARENA_FINA'),
    ('G1', 'GRAVA'),
    ('G2', 'GRAVA_GRUESA')
) AS codes(arkik_code, material_search)
JOIN public.materials m ON (
  m.plant_id = p.id 
  AND m.is_active = true 
  AND (
    UPPER(m.material_name) LIKE '%' || codes.material_search || '%'
    OR UPPER(m.material_code) LIKE '%' || codes.material_search || '%'
  )
)
ON CONFLICT (plant_id, arkik_code) DO NOTHING;

COMMIT;
