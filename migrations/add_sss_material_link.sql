-- Link SSS (SSD) reference values to concrete materials and track Arkik export status

-- 1) Enrich recipe_reference_materials with material linkage and unit
ALTER TABLE public.recipe_reference_materials
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id);

ALTER TABLE public.recipe_reference_materials
  ADD COLUMN IF NOT EXISTS unit text;

-- 2) Track Arkik export status on recipe versions (similar to loaded_to_k2)
ALTER TABLE public.recipe_versions
  ADD COLUMN IF NOT EXISTS loaded_to_arkik boolean DEFAULT false;

-- Helpful comments
COMMENT ON COLUMN public.recipe_reference_materials.material_id IS 'Optional: link SSS reference value to a specific material master record.';
COMMENT ON COLUMN public.recipe_reference_materials.unit IS 'Optional: unit for SSS value (e.g., kg/m³, L/m³).';
COMMENT ON COLUMN public.recipe_versions.loaded_to_arkik IS 'Whether this recipe version has been exported to Arkik.';


