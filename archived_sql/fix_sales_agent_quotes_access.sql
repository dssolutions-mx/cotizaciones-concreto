-- Allow sales agents to see all approved quotes
-- This change modifies the existing policy to give sales agents access to all approved quotes

BEGIN;

-- First, drop the current view policy
DROP POLICY IF EXISTS sales_agents_view_own_quotes ON quotes;

-- Create a new policy that allows:
-- 1. Sales agents to see their own quotes (any status)
-- 2. Sales agents to see all approved quotes
-- 3. Plant managers and executives to see all quotes
CREATE POLICY sales_agents_view_quotes 
ON quotes
FOR SELECT 
TO authenticated 
USING (
  -- Sales agents can see any of their own quotes
  created_by = auth.uid() 
  OR 
  -- Sales agents can see all approved quotes
  (
    status = 'APPROVED' 
    AND 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'SALES_AGENT'
    )
  )
  OR
  -- Plant managers and executives can see all quotes
  EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_profiles.id = auth.uid() 
    AND user_profiles.role IN ('PLANT_MANAGER', 'EXECUTIVE')
  )
);

-- Add comment to explain the policy
COMMENT ON POLICY sales_agents_view_quotes ON quotes IS 'Allows sales agents to see their own quotes plus all approved quotes, and allows managers and executives to see all quotes';

COMMIT; 