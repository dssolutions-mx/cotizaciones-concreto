-- Fix inconsistent role usage in user_profiles policies
-- Currently there's a mix of {public} and {authenticated} roles

-- First, let's standardize all policies to use authenticated role instead of public role

-- 1. Fix authenticated_users_can_view_profiles
ALTER POLICY authenticated_users_can_view_profiles 
ON user_profiles 
TO authenticated;

-- 2. Fix executives_can_delete_profiles
ALTER POLICY executives_can_delete_profiles
ON user_profiles
TO authenticated;

-- 3. Fix executives_can_insert_profiles
ALTER POLICY executives_can_insert_profiles
ON user_profiles
TO authenticated;

-- 4. Fix executives_can_update_any_profile
ALTER POLICY executives_can_update_any_profile
ON user_profiles
TO authenticated;

-- 5. Fix users_can_update_own_profile_except_role 
ALTER POLICY users_can_update_own_profile_except_role
ON user_profiles
TO authenticated;

-- Ensure all policies have appropriate comments
COMMENT ON POLICY authenticated_users_can_view_profiles ON user_profiles IS 'Allows authenticated users to view user profiles';
COMMENT ON POLICY executives_can_delete_profiles ON user_profiles IS 'Only EXECUTIVE role can delete user profiles';
COMMENT ON POLICY executives_can_insert_profiles ON user_profiles IS 'Only EXECUTIVE role can create new user profiles';
COMMENT ON POLICY executives_can_update_any_profile ON user_profiles IS 'EXECUTIVE role can update any user profile';
COMMENT ON POLICY only_executives_can_update_roles ON user_profiles IS 'Only EXECUTIVE role can update the role field of user profiles';
COMMENT ON POLICY users_can_update_own_profile_except_role ON user_profiles IS 'Users can update their own profile except for the role field'; 