-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "users_can_view_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "executives_can_update_roles" ON public.user_profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.user_profiles;

-- Create a policy that allows all authenticated users to view all profiles
-- This is a simpler approach that avoids the recursion problem while still providing security
CREATE POLICY "authenticated_users_can_view_profiles"
ON public.user_profiles
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only executives can update other users' profiles
CREATE POLICY "executives_can_update_any_profile"
ON public.user_profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'EXECUTIVE'
  )
);

-- Users can update their own profile except for the role field
CREATE POLICY "users_can_update_own_profile_except_role"
ON public.user_profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid() AND
  -- If changing role, the operation should be rejected
  (role IS NOT NULL AND role = (SELECT role FROM public.user_profiles WHERE id = auth.uid()))
);

-- Only executives can insert new profiles
CREATE POLICY "executives_can_insert_profiles"
ON public.user_profiles
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'EXECUTIVE'
  )
);

-- Only executives can delete profiles
CREATE POLICY "executives_can_delete_profiles"
ON public.user_profiles
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'EXECUTIVE'
  )
); 