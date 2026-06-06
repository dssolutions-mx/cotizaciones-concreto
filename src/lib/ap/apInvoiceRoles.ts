/** Roles allowed to create, edit, or unlink supplier invoices (CxP). */
export const AP_INVOICE_WRITE_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
  'ADMIN',
  'PLANT_MANAGER',
] as const

function normalizeRoleKey(role: string): string {
  return role.trim().toUpperCase().replace(/\s+/g, '_')
}

export function canWriteApInvoices(role: string | undefined): boolean {
  if (!role) return false
  return (AP_INVOICE_WRITE_ROLES as readonly string[]).includes(normalizeRoleKey(role))
}
