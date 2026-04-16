/**
 * Default post-auth path by app role. Keep in sync with login and auth callback flows.
 */
export function getDefaultPathForRole(role: string | undefined): string {
  switch (role) {
    case 'EXTERNAL_CLIENT':
      return '/client-portal';
    case 'QUALITY_TEAM':
      return '/quality/muestreos';
    case 'LABORATORY':
    case 'PLANT_MANAGER':
      return '/quality';
    default:
      return '/dashboard';
  }
}
