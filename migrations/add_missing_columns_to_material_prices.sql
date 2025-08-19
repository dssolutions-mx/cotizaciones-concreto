-- Add missing columns to material_prices table for materials migration
-- This migration adds the new columns needed for the enhanced materials system

BEGIN;

-- Add material_id column for linking to the materials master table
ALTER TABLE material_prices ADD COLUMN IF NOT EXISTS material_id UUID REFERENCES public.materials(id);

-- Add plant_id column for plant-specific pricing
ALTER TABLE material_prices ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES public.plants(id);

-- Add created_by column for tracking who created the price
ALTER TABLE material_prices ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_material_prices_material_id ON material_prices(material_id);
CREATE INDEX IF NOT EXISTS idx_material_prices_plant_id ON material_prices(plant_id);
CREATE INDEX IF NOT EXISTS idx_material_prices_created_by ON material_prices(created_by);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_material_prices_material_plant ON material_prices(material_id, plant_id);
CREATE INDEX IF NOT EXISTS idx_material_prices_plant_effective ON material_prices(plant_id, effective_date);

-- Add comments for documentation
COMMENT ON COLUMN material_prices.material_id IS 'Reference to the materials master table for enhanced material management';
COMMENT ON COLUMN material_prices.plant_id IS 'Plant where this material price is applicable';
COMMENT ON COLUMN material_prices.created_by IS 'User who created this material price';

-- Update existing records to have plant_id from materials table if available
-- This ensures data consistency for existing records
UPDATE material_prices 
SET plant_id = m.plant_id
FROM materials m
WHERE material_prices.material_type = m.material_code 
AND material_prices.plant_id IS NULL
AND m.plant_id IS NOT NULL;

COMMIT;
