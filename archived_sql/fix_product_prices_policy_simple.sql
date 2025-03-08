-- Simple fix for product_prices policy to allow PLANT_MANAGER to insert records
-- This resolves the error: "new row violates row-level security policy for table "product_prices""

BEGIN;

-- Drop the existing policy
DROP POLICY IF EXISTS quality_team_executive_manage_prices ON product_prices;

-- Create a new policy that includes PLANT_MANAGER
CREATE POLICY role_based_product_prices_management
ON product_prices
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role IN ('QUALITY_TEAM', 'PLANT_MANAGER', 'EXECUTIVE')
  )
);

-- Add comment to explain the policy
COMMENT ON POLICY role_based_product_prices_management ON product_prices IS 
  'Allows QUALITY_TEAM, PLANT_MANAGER, and EXECUTIVE to manage product prices';

COMMIT; 