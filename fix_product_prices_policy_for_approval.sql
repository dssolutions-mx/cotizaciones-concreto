-- Fix RLS policy for product_prices to allow PLANT_MANAGER to create records during quote approval
-- This resolves the error: "new row violates row-level security policy for table "product_prices""

BEGIN;

-- First, let's get the current policy to understand what we're working with
-- The current policy only allows QUALITY_TEAM and EXECUTIVE to manage product prices

-- Update or create a policy that allows PLANT_MANAGER to perform INSERT when approving quotes
CREATE POLICY plant_manager_approve_quotes_product_prices
ON product_prices
FOR INSERT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role = 'PLANT_MANAGER'
    AND current_setting('app.context') = 'quote_approval'
  )
);

-- Note: For this to work properly, we need a way to set the application context
-- when a PLANT_MANAGER is approving a quote. We'll add a function to handle this.

-- Create a function to set the application context before approving a quote
CREATE OR REPLACE FUNCTION set_quote_approval_context() RETURNS void AS $$
BEGIN
  PERFORM set_config('app.context', 'quote_approval', false);
END;
$$ LANGUAGE plpgsql;

-- Add comment to explain the policy
COMMENT ON POLICY plant_manager_approve_quotes_product_prices ON product_prices IS 
  'Allows PLANT_MANAGER to insert into product_prices when approving quotes';

-- Alternative approach if custom context setting isn't feasible:
-- We can directly modify the existing policy to include PLANT_MANAGER role

DROP POLICY IF EXISTS quality_team_executive_manage_prices ON product_prices;

CREATE POLICY quality_team_executive_manage_prices
ON product_prices
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND (
      user_profiles.role IN ('QUALITY_TEAM', 'EXECUTIVE')
      OR 
      -- Allow PLANT_MANAGER to manage product prices only when related to a quote
      (
        user_profiles.role = 'PLANT_MANAGER'
        AND EXISTS (
          SELECT 1
          FROM quotes q
          JOIN quote_details qd ON q.id = qd.quote_id
          WHERE q.status = 'PENDING_APPROVAL'
          AND product_prices.quote_detail_id = qd.id
        )
      )
    )
  )
);

COMMENT ON POLICY quality_team_executive_manage_prices ON product_prices IS 
  'Allows QUALITY_TEAM and EXECUTIVE to manage product prices, and PLANT_MANAGER to manage them when approving quotes';

COMMIT; 