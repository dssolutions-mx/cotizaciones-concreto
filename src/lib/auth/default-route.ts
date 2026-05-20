/**
 * Default post-auth path by app role. Keep in sync with login and auth callback flows.
 * @see role-home.ts for full role landing configuration
 */
export {
  getDefaultPathForRole,
  getDashboardVariant,
  getDashboardNavLabel,
  getRoleHome,
} from '@/lib/auth/role-home';
