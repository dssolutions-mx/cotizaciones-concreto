/**
 * Canonical role lists for inventory APIs — keep in sync with RLS expectations on
 * material_entries / material_inventory and with procurement operators (ADMIN_OPERATIONS).
 */

export const INVENTORY_STANDARD_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'DOSIFICADOR',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
  /** Finanzas / contabilidad (centro de compras, export balances) — needs recepciones + revisión de precios */
  'ADMINISTRATIVE',
  /** Legacy / calidad — algunos proyectos aún usan este rol en user_profiles */
  'ADMIN',
] as const

export type InventoryStandardRole = (typeof INVENTORY_STANDARD_ROLES)[number]

/** Roles that may mark material entry pricing as reviewed (must match PUT /api/inventory/entries). */
export const ENTRY_PRICING_REVIEW_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
  'ADMIN',
] as const

export function canCompleteEntryPricingReview(role: string | undefined): boolean {
  if (!role) return false
  return (ENTRY_PRICING_REVIEW_ROLES as readonly string[]).includes(role)
}

/** Same roles as pricing review: list/update entries without plant filter and pick workspace plant in compras. */
export function canAccessAllInventoryPlants(role: string | undefined): boolean {
  return canCompleteEntryPricingReview(role)
}

/** Roles that may scope by query param plant_id (cross-plant read) when profile.plant_id is null */
export function isGlobalInventoryRole(role: string | undefined): boolean {
  return (
    role === 'EXECUTIVE' ||
    role === 'ADMIN_OPERATIONS' ||
    role === 'CREDIT_VALIDATOR' ||
    role === 'ADMINISTRATIVE' ||
    role === 'ADMIN'
  )
}

export function hasInventoryStandardAccess(role: string | undefined): boolean {
  if (!role) return false
  return (INVENTORY_STANDARD_ROLES as readonly string[]).includes(role)
}
