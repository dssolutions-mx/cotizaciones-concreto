-- Add coordinate columns to construction_sites table
ALTER TABLE construction_sites ADD COLUMN latitude FLOAT;
ALTER TABLE construction_sites ADD COLUMN longitude FLOAT;

-- Add a comment to the columns for documentation
COMMENT ON COLUMN construction_sites.latitude IS 'The geographic latitude coordinate of the construction site.';
COMMENT ON COLUMN construction_sites.longitude IS 'The geographic longitude coordinate of the construction site.'; 