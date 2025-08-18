-- Add plant_id column to product_prices table
-- This is needed to properly associate product prices with specific plants
-- and fix the issue where plant_id is not being loaded during quote approval

BEGIN;

-- Add plant_id column to product_prices table
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS plant_id UUID REFERENCES public.plants(id);

-- Create an index on plant_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_prices_plant_id 
ON product_prices(plant_id);

-- Create a composite index on plant_id, client_id, recipe_id, and construction_site
-- This will optimize queries that filter by all these fields
CREATE INDEX IF NOT EXISTS idx_product_prices_plant_client_recipe_site 
ON product_prices(plant_id, client_id, recipe_id, construction_site);

-- Add a comment to the column for documentation
COMMENT ON COLUMN product_prices.plant_id IS 'The plant associated with this product price. Used for plant-specific pricing and filtering.';

-- Update existing records to have plant_id from their associated recipes
-- This ensures data consistency for existing records
UPDATE product_prices 
SET plant_id = r.plant_id
FROM recipes r
WHERE product_prices.recipe_id = r.id 
AND product_prices.plant_id IS NULL;

COMMIT;
