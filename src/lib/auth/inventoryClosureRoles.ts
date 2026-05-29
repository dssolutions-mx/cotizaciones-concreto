import { canAccessAllInventoryPlants } from '@/lib/auth/inventoryRoles'

/** Roles that can open and work through a closure wizard */
export const INVENTORY_CLOSURE_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'DOSIFICADOR',
] as const

/** Roles that may sign and seal a closure (dosificador on own plant) */
export const INVENTORY_CLOSURE_SEAL_ROLES = INVENTORY_CLOSURE_ROLES

/** Roles that may cancel closures or create amendments */
export const INVENTORY_CLOSURE_ADMIN_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
] as const

/** Hard-delete closure records (test data / mistaken runs). Does not remove material adjustments. */
export const INVENTORY_CLOSURE_DELETE_ROLES = ['EXECUTIVE'] as const

export function canAccessInventoryClosure(role: string | undefined): boolean {
  if (!role) return false
  return (INVENTORY_CLOSURE_ROLES as readonly string[]).includes(role)
}

export function canSealInventoryClosure(role: string | undefined): boolean {
  return canAccessInventoryClosure(role)
}

export function canAdminInventoryClosure(role: string | undefined): boolean {
  if (!role) return false
  return (INVENTORY_CLOSURE_ADMIN_ROLES as readonly string[]).includes(role)
}

export function canDeleteInventoryClosure(role: string | undefined): boolean {
  if (!role) return false
  return (INVENTORY_CLOSURE_DELETE_ROLES as readonly string[]).includes(role)
}

export function assertClosurePlantAccess(
  profile: { role: string; plant_id?: string | null },
  closurePlantId: string,
): void {
  if (canAccessAllInventoryPlants(profile.role)) return
  if (profile.plant_id !== closurePlantId) {
    throw new Error('Sin permisos para este cierre')
  }
}
