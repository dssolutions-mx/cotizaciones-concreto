-- Add loaded_to_k2 column to recipe_versions table
ALTER TABLE recipe_versions ADD COLUMN IF NOT EXISTS loaded_to_k2 BOOLEAN DEFAULT FALSE;

-- Comment on the column
COMMENT ON COLUMN recipe_versions.loaded_to_k2 IS 'Indicates whether this recipe version has been loaded into the K2 system'; 