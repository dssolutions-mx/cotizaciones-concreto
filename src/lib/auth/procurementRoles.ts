/**
 * Shared procurement / finanzas PO+AP roles (for documentation and gradual migration).
 * Prefer importing domain-specific modules (inventoryRoles, materialsCatalogRoles) in routes.
 */

export const PROCUREMENT_PO_READ_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
] as const

export const PROCUREMENT_PO_WRITE_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS'] as const
