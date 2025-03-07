-- Add construction_site column to product_prices table
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS construction_site TEXT;

-- Update existing records to have NULL in the construction_site column
UPDATE product_prices SET construction_site = NULL WHERE construction_site IS NULL;

-- Create an index on client_id, recipe_id, and construction_site for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_prices_client_recipe_site 
ON product_prices(client_id, recipe_id, construction_site);

-- Add a comment to the column for documentation
COMMENT ON COLUMN product_prices.construction_site IS 'The construction site associated with this price. Used for client-specific pricing per construction site.'; 