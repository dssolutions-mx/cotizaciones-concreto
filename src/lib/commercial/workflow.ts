/** Rutas y mensajes compartidos del flujo comercial (cliente → obra → cotización). */

export const COMMERCIAL_WORKFLOW_STEPS =
  'Crear cliente → Aprobar cliente → Crear y aprobar obra → Cotizar → Orden → Crédito';

export const GOVERNANCE_CLIENTS_PATH = '/finanzas/gobierno-precios';

export type ApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | string;

export function isApproved(status?: ApprovalStatus | null): boolean {
  return (status || '').toUpperCase() === 'APPROVED';
}

export function isPendingApproval(status?: ApprovalStatus | null): boolean {
  return (status || '').toUpperCase() === 'PENDING_APPROVAL';
}

export const MESSAGES = {
  clientPending:
    'Este cliente está pendiente de autorización. No puede crear obras ni cotizar hasta que Finanzas lo apruebe.',
  clientPendingShort:
    'Cliente pendiente de autorización. Solicite la aprobación en Finanzas → Autorización de Clientes.',
  sitePendingAfterCreate:
    'Obra registrada y pendiente de autorización. Podrá usarla en cotizaciones cuando Finanzas la apruebe (pestaña Obras).',
  noApprovedSites:
    'No hay obras aprobadas para este cliente. Cree una obra y espere su autorización antes de cotizar.',
  selectApprovedSite:
    'Seleccione una obra aprobada del listado. Si acaba de crear una obra, espere su autorización en Finanzas.',
  clientCreatedPending:
    'Cliente creado correctamente. Queda pendiente de autorización; podrá cotizar cuando Finanzas lo apruebe.',
  obraRequiresApprovedClient:
    'El cliente debe estar autorizado antes de registrar obras.',
} as const;
