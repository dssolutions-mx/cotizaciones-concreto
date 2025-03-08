-- Fix all policy discrepancies and inconsistencies
-- Created based on policy review

BEGIN;

-- -----------------------------------------------------
-- 1. Remove duplicate policies
-- -----------------------------------------------------

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

-- -----------------------------------------------------
-- 2. Fix product_prices policy inconsistency
-- -----------------------------------------------------

-- Fix inconsistency in product_prices policies
-- Currently QUALITY_TEAM can't SELECT (due to exclusion) but has ALL permissions (logical inconsistency)
DROP POLICY IF EXISTS everyone_except_quality_team_select_prices ON product_prices;

-- Create a new policy that allows all authenticated users to SELECT product_prices
CREATE POLICY everyone_can_read_product_prices
ON product_prices
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY everyone_can_read_product_prices ON product_prices IS 'Allows all authenticated users to view product prices';
COMMENT ON POLICY quality_team_executive_manage_prices ON product_prices IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage product prices';

-- -----------------------------------------------------
-- 3. Standardize user_profiles policies
-- -----------------------------------------------------

-- Standardize all policies to use authenticated role instead of public role
ALTER POLICY authenticated_users_can_view_profiles 
ON user_profiles 
TO authenticated;

ALTER POLICY executives_can_delete_profiles
ON user_profiles
TO authenticated;

ALTER POLICY executives_can_insert_profiles
ON user_profiles
TO authenticated;

ALTER POLICY executives_can_update_any_profile
ON user_profiles
TO authenticated;

ALTER POLICY users_can_update_own_profile_except_role
ON user_profiles
TO authenticated;

-- Add comments to all user_profiles policies
COMMENT ON POLICY authenticated_users_can_view_profiles ON user_profiles IS 'Allows authenticated users to view user profiles';
COMMENT ON POLICY executives_can_delete_profiles ON user_profiles IS 'Only EXECUTIVE role can delete user profiles';
COMMENT ON POLICY executives_can_insert_profiles ON user_profiles IS 'Only EXECUTIVE role can create new user profiles';
COMMENT ON POLICY executives_can_update_any_profile ON user_profiles IS 'EXECUTIVE role can update any user profile';
COMMENT ON POLICY only_executives_can_update_roles ON user_profiles IS 'Only EXECUTIVE role can update the role field of user profiles';
COMMENT ON POLICY users_can_update_own_profile_except_role ON user_profiles IS 'Users can update their own profile except for the role field';

COMMIT; 