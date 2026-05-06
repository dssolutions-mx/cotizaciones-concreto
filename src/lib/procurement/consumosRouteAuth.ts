/**
 * Authorization for GET /api/procurement/consumos and related routes.
 * Plant-bound roles (PLANT_MANAGER, DOSIFICADOR) may only read their assigned plant.
 */

export const FINANZAS_PROCUREMENT_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'SALES_AGENT',
] as const

export type FinanzasProcurementRole = (typeof FINANZAS_PROCUREMENT_ROLES)[number]

export function isFinanzasProcurementRole(role: string): boolean {
  return (FINANZAS_PROCUREMENT_ROLES as readonly string[]).includes(role)
}

/** Roles that may call consumos APIs only for own plant (same lock as PLANT_MANAGER). */
export function isPlantLockedConsumosRole(role: string): boolean {
  return role === 'PLANT_MANAGER' || role === 'DOSIFICADOR'
}

export function canAccessProcurementConsumosRoutes(profile: {
  role: string
  plant_id: string | null
}): boolean {
  if (isFinanzasProcurementRole(profile.role)) return true
  if (profile.role === 'DOSIFICADOR' && profile.plant_id) return true
  return false
}

/**
 * Single plant id for consumos read after applying plant lock (dosificador / jefe de planta).
 */
export function lockedConsumosPlantId(
  profile: { role: string; plant_id: string | null },
  requestedPlantId: string | undefined
): string | undefined {
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
    return profile.plant_id
  }
  if (profile.role === 'DOSIFICADOR') {
    return profile.plant_id ?? undefined
  }
  return requestedPlantId
}
