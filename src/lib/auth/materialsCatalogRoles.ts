/**
 * Roles allowed to create/update/deactivate catalog materials via API.
 * Align with RLS on public.materials when using the user JWT.
 */

export const MATERIAL_CATALOG_WRITE_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'DOSIFICADOR',
  'QUALITY_TEAM',
  'ADMIN_OPERATIONS',
] as const

export function canWriteMaterialsCatalog(role: string | undefined): boolean {
  if (!role) return false
  return (MATERIAL_CATALOG_WRITE_ROLES as readonly string[]).includes(role)
}
