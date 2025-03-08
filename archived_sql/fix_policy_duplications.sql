-- This script removes duplicate policies from the database
-- Created based on policy review on [DATE]

-- Administrative Costs: Remove the duplicate ALL policy
DROP POLICY IF EXISTS plant_manager_manage_admin_costs ON administrative_costs;
COMMENT ON POLICY plant_manager_admin_costs_access ON administrative_costs IS 'Allows PLANT_MANAGER and EXECUTIVE roles to perform all operations on administrative costs';

-- Material Prices: Remove duplicate policies
DROP POLICY IF EXISTS everyone_read_material_prices ON material_prices;
COMMENT ON POLICY everyone_can_read_material_prices ON material_prices IS 'Allows all authenticated users to view material prices';

DROP POLICY IF EXISTS quality_team_manage_material_prices ON material_prices;
COMMENT ON POLICY quality_team_full_material_prices_access ON material_prices IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage material prices';

-- Recipe Reference Materials: Remove duplicate policies
DROP POLICY IF EXISTS read_recipe_materials_policy ON recipe_reference_materials;
COMMENT ON POLICY everyone_can_read_recipe_references ON recipe_reference_materials IS 'Allows all authenticated users to view recipe reference materials';

DROP POLICY IF EXISTS quality_team_full_recipe_references_access ON recipe_reference_materials;
COMMENT ON POLICY manage_recipe_materials_policy ON recipe_reference_materials IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage recipe reference materials';

-- Recipe Versions: Remove duplicate policies
DROP POLICY IF EXISTS read_recipe_versions_policy ON recipe_versions;
COMMENT ON POLICY everyone_can_read_recipe_versions ON recipe_versions IS 'Allows all authenticated users to view recipe versions';

DROP POLICY IF EXISTS quality_team_full_recipe_versions_access ON recipe_versions;
COMMENT ON POLICY manage_recipe_versions_policy ON recipe_versions IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage recipe versions';

-- Recipes: Remove duplicate policies
DROP POLICY IF EXISTS read_recipes_policy ON recipes;
COMMENT ON POLICY everyone_can_read_recipes ON recipes IS 'Allows all authenticated users to view recipes';

DROP POLICY IF EXISTS quality_team_full_recipes_access ON recipes;
COMMENT ON POLICY manage_recipes_policy ON recipes IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage recipes'; 