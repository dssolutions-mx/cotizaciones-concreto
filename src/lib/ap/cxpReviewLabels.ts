import { MANUAL_REASON_LABELS } from '@/lib/ap/invoiceTotals'
import { labelForFormaPago, labelForMetodoPago } from '@/lib/sat/codigosSat'

/** Etiquetas en español para valores exportados a Excel (sin enums en inglés). */

const INVOICE_STATUS: Record<string, string> = {
  open: 'Abierta',
  partially_paid: 'Pago parcial',
  paid: 'Pagada',
  void: 'Anulada',
}

const CREDIT_NOTE_STATUS: Record<string, string> = {
  open: 'Sin aplicar',
  partially_applied: 'Aplicación parcial',
  fully_applied: 'Aplicada',
  void: 'Anulada',
}

const CREDIT_NOTE_REASON: Record<string, string> = {
  price_adjustment: 'Ajuste de precio',
  return: 'Devolución',
  defect: 'Defecto',
  other: 'Otro',
}

const INVOICE_SOURCE: Record<string, string> = {
  system: 'Desde recepciones',
  historical: 'Histórica (manual)',
  mixed: 'Mixta (recepciones y manual)',
}

const COST_CATEGORY: Record<string, string> = {
  material: 'Material',
  fleet: 'Flota / flete',
}

const PAYMENT_SOURCE: Record<string, string> = {
  manual: 'Registro manual',
  sat_rep: 'Complemento de pago (SAT)',
}

const PRICING_STATUS: Record<string, string> = {
  pending: 'Precio pendiente',
  reviewed: 'Precio revisado',
}

const CFDI_ESTADO_SAT: Record<string, string> = {
  vigente: 'Vigente',
  cancelado: 'Cancelado',
}

function fallbackSpanish(raw: string | null | undefined, map: Record<string, string>): string {
  if (!raw) return ''
  const key = raw.trim().toLowerCase()
  return map[key] ?? map[raw] ?? raw
}

export function invoiceStatusLabelEs(status: string): string {
  return fallbackSpanish(status, INVOICE_STATUS) || 'Sin estado'
}

export function creditNoteStatusLabelEs(status: string): string {
  return fallbackSpanish(status, CREDIT_NOTE_STATUS) || 'Sin estado'
}

export function creditNoteReasonLabelEs(reason: string): string {
  return fallbackSpanish(reason, CREDIT_NOTE_REASON) || 'Otro'
}

export function invoiceSourceLabelEs(
  source: string,
  isInternal?: boolean,
): string {
  if (source === 'system') {
    return isInternal ? 'Interna (sistema)' : 'Normal (recepciones)'
  }
  return fallbackSpanish(source, INVOICE_SOURCE) || 'Otro'
}

export function costCategoryLabelEs(category: string): string {
  return fallbackSpanish(category, COST_CATEGORY) || category
}

export function paymentSourceLabelEs(source: string | null | undefined): string {
  if (!source) return '—'
  return fallbackSpanish(source, PAYMENT_SOURCE) || source
}

export function pricingStatusLabelEs(status: string | null | undefined): string {
  if (!status) return '—'
  return fallbackSpanish(status, PRICING_STATUS) || status
}

export function cfdiEstadoSatLabelEs(estado: string | null | undefined): string {
  if (!estado) return ''
  return fallbackSpanish(estado, CFDI_ESTADO_SAT) || estado
}

export function cfdiMetodoPagoLabelEs(code: string | null | undefined): string {
  return labelForMetodoPago(code) || ''
}

export function paymentMethodLabelEs(method: string | null | undefined): string {
  if (!method) return ''
  const trimmed = method.trim()
  if (/^\d{2}$/.test(trimmed)) return labelForFormaPago(trimmed)
  return trimmed
}

export function invoiceLineLinkageLabelEs(
  entryId: string | null | undefined,
  lineSource: string | null | undefined,
  manualReason: string | null | undefined,
): string {
  if (entryId) return 'Vinculada a recepción'
  if (lineSource === 'entry') return 'Recepción (referencia)'
  if (lineSource === 'manual' || manualReason) {
    return MANUAL_REASON_LABELS[manualReason ?? ''] ?? 'Línea manual sin recepción'
  }
  return 'Sin recepción vinculada'
}

export function orphanEntryKindLabelEs(kind: 'material' | 'fleet'): string {
  return kind === 'fleet' ? 'Flota' : 'Material'
}
