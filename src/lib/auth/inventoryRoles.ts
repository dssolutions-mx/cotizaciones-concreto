/**
 * Canonical role lists for inventory APIs — keep in sync with RLS expectations on
 * material_entries / material_inventory and with procurement operators (ADMIN_OPERATIONS).
 */

export const INVENTORY_STANDARD_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'DOSIFICADOR',
  'ADMIN_OPERATIONS',
] as const

export type InventoryStandardRole = (typeof INVENTORY_STANDARD_ROLES)[number]

/** Roles that may scope by query param plant_id (cross-plant read) when profile.plant_id is null */
export function isGlobalInventoryRole(role: string | undefined): boolean {
  return role === 'EXECUTIVE' || role === 'ADMIN_OPERATIONS'
}

export function hasInventoryStandardAccess(role: string | undefined): boolean {
  if (!role) return false
  return (INVENTORY_STANDARD_ROLES as readonly string[]).includes(role)
}
