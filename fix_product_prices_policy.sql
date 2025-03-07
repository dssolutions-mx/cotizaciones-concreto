-- Fix inconsistency in product_prices policies
-- Currently QUALITY_TEAM can't SELECT (due to exclusion) but has ALL permissions (logical inconsistency)

-- First drop the inconsistent policy
DROP POLICY IF EXISTS everyone_except_quality_team_select_prices ON product_prices;

-- Create a new policy that allows all authenticated users to SELECT product_prices
CREATE POLICY everyone_can_read_product_prices
ON product_prices
FOR SELECT
TO authenticated
USING (true);

-- The existing policy remains for management:
-- quality_team_executive_manage_prices: ALL operations for QUALITY_TEAM/EXECUTIVE

COMMENT ON POLICY everyone_can_read_product_prices ON product_prices IS 'Allows all authenticated users to view product prices';
COMMENT ON POLICY quality_team_executive_manage_prices ON product_prices IS 'Gives QUALITY_TEAM and EXECUTIVE roles full access to manage product prices'; 