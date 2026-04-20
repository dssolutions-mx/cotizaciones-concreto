export type AuditProfile = {
  id: string
  role: string
  plant_id: string | null
}

/** Roles that can mutate prices / quotes / product_prices from the audit console. */
export const FINANZAS_AUDIT_WRITER_ROLES = new Set([
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
])

/** Only these roles may edit orders that are completed or cancelled. */
export const FINANZAS_AUDIT_POST_CLOSE_ROLES = new Set(['EXECUTIVE', 'ADMIN_OPERATIONS'])

export function canWriteFinanzasAudit(profile: Pick<AuditProfile, 'role'> | null | undefined): boolean {
  return !!profile?.role && FINANZAS_AUDIT_WRITER_ROLES.has(profile.role)
}

export function canPostCloseFinanzasAudit(profile: Pick<AuditProfile, 'role'> | null | undefined): boolean {
  return !!profile?.role && FINANZAS_AUDIT_POST_CLOSE_ROLES.has(profile.role)
}

/**
 * Same plant scoping as canReadConcreteEvidence on orders/[id]/concrete-evidence.
 */
export function canAccessOrderForFinanzasAudit(
  profile: Pick<AuditProfile, 'role' | 'plant_id'>,
  orderPlantId: string
): boolean {
  if (['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role) && profile.plant_id == null) {
    return true
  }
  if (['EXECUTIVE', 'ADMIN_OPERATIONS'].includes(profile.role)) {
    return profile.plant_id === orderPlantId
  }
  if (['SALES_AGENT', 'CREDIT_VALIDATOR', 'ADMINISTRATIVE'].includes(profile.role)) {
    if (profile.plant_id == null) return true
    return profile.plant_id === orderPlantId
  }
  if (['PLANT_MANAGER', 'DOSIFICADOR'].includes(profile.role) && profile.plant_id === orderPlantId) {
    return true
  }
  if (profile.role === 'ADMIN' && profile.plant_id == null) return true
  if (profile.role === 'ADMIN' && profile.plant_id === orderPlantId) return true
  return false
}

export function assertWritableOrderStatus(
  orderStatus: string,
  profile: Pick<AuditProfile, 'role'>,
  allowPostClose?: boolean
): void {
  if (orderStatus === 'completed' || orderStatus === 'cancelled') {
    if (!canPostCloseFinanzasAudit(profile)) {
      throw new Error('Solo Ejecutivo u Operaciones Admin pueden corregir pedidos completados o cancelados.')
    }
    if (!allowPostClose) {
      throw new Error('Marque la casilla de autorización para corrección post-cierre.')
    }
  }
}
