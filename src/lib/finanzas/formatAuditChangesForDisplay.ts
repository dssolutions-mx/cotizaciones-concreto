import { formatMxCurrency } from '@/lib/finanzas/formatMxCurrency'

export type AuditChangeLine = {
  label: string
  before: string
  after: string
}

const ORDER_ITEM_KEY_LABELS: Record<string, string> = {
  unit_price: 'Precio unitario',
  total_price: 'Total de la línea',
  quote_detail_id: 'Vinculación a línea de cotización',
  volume: 'Volumen',
  pump_price: 'Precio bombeo',
  product_type: 'Producto',
  recipe_id: 'Receta',
  master_recipe_id: 'Receta maestra',
  billing_type: 'Tipo de facturación',
  has_pump_service: 'Servicio de bombeo',
  product_price_id: 'Precio de lista aplicado',
}

const QUOTE_DETAIL_KEY_LABELS: Record<string, string> = {
  final_price: 'Precio en cotización (m³)',
  base_price: 'Precio base (cotización)',
  profit_margin: 'Margen (cotización)',
  pump_price: 'Bombeo (cotización)',
}

const CURRENCY_KEYS = new Set([
  'unit_price',
  'total_price',
  'pump_price',
  'final_price',
  'base_price',
])

const ID_KEYS = new Set([
  'quote_detail_id',
  'recipe_id',
  'master_recipe_id',
  'product_price_id',
])

/** Texto legible para cambios de IDs técnicos (sin exponer UUID). */
function humanizeIdFieldChange(
  key: string,
  oldV: unknown,
  newV: unknown
): { before: string; after: string } {
  if (key === 'quote_detail_id') {
    const o = oldV == null || oldV === '' ? null : String(oldV)
    const n = newV == null || newV === '' ? null : String(newV)
    if (o === n) return { before: '—', after: '—' }
    if (!o && n) return { before: 'Sin vínculo', after: 'Vinculado a línea de cotización' }
    if (o && !n) return { before: 'Con vínculo', after: 'Sin vínculo' }
    return { before: 'Vinculación anterior', after: 'Nueva vinculación' }
  }
  const o = oldV == null || oldV === '' ? null : String(oldV)
  const n = newV == null || newV === '' ? null : String(newV)
  if (o === n) return { before: '—', after: '—' }
  if (!o && n) return { before: 'Sin asignar', after: 'Asignado' }
  if (o && !n) return { before: 'Asignado', after: 'Quitado' }
  return { before: 'Valor anterior', after: 'Nuevo valor' }
}

function formatScalar(key: string, val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Sí' : 'No'
  if (typeof val === 'number') {
    if (CURRENCY_KEYS.has(key)) return formatMxCurrency(val)
    if (key === 'profit_margin') return String(val)
    return String(val)
  }
  if (typeof val === 'string') {
    if (key === 'quote_detail_id') {
      return val.trim() ? 'Vinculado' : 'Sin vínculo'
    }
    if (ID_KEYS.has(key) && /^[0-9a-f-]{36}$/i.test(val.trim())) {
      return 'Asignado'
    }
    if (key === '' && /^[0-9a-f-]{36}$/i.test(val.trim())) {
      return '—'
    }
    return val
  }
  if (typeof val === 'object') return '…'
  return String(val)
}

function summarizeOrderItemRow(row: Record<string, unknown>): string {
  const parts: string[] = []
  if (row.product_type != null) parts.push(String(row.product_type))
  if (row.volume != null) parts.push(`vol. ${row.volume}`)
  const pu = Number(row.unit_price)
  if (Number.isFinite(pu)) parts.push(`PU ${formatMxCurrency(pu)}`)
  const tt = Number(row.total_price)
  if (Number.isFinite(tt)) parts.push(`total ${formatMxCurrency(tt)}`)
  return parts.length > 0 ? parts.join(' · ') : 'Línea de pedido'
}

/**
 * Convierte el JSON `changes` del finanzas_audit_log en líneas legibles para la UI.
 */
export function formatAuditChangesForDisplay(changes: unknown): AuditChangeLine[] {
  if (!Array.isArray(changes)) return []

  const out: AuditChangeLine[] = []

  for (const raw of changes) {
    if (!raw || typeof raw !== 'object') continue
    const field = String((raw as { field?: unknown }).field ?? '')
    const oldV = (raw as { old?: unknown }).old
    const newV = (raw as { new?: unknown }).new

    const orderItemDot = field.match(/^order_item\.([0-9a-f-]{36})\.(.+)$/i)
    if (orderItemDot) {
      const key = orderItemDot[2]
      const labelBase = ORDER_ITEM_KEY_LABELS[key] ?? key.replace(/_/g, ' ')
      const label = `${labelBase} (línea)`
      if (ID_KEYS.has(key)) {
        const { before, after } = humanizeIdFieldChange(key, oldV, newV)
        out.push({ label, before, after })
      } else {
        out.push({
          label,
          before: formatScalar(key, oldV),
          after: formatScalar(key, newV),
        })
      }
      continue
    }

    const qdDot = field.match(/^quote_detail\.([0-9a-f-]{36})\.(.+)$/i)
    if (qdDot) {
      const key = qdDot[2]
      const labelBase = QUOTE_DETAIL_KEY_LABELS[key] ?? key.replace(/_/g, ' ')
      out.push({
        label: `${labelBase} (cotización)`,
        before: formatScalar(key, oldV),
        after: formatScalar(key, newV),
      })
      continue
    }

    if (field.match(/^order_item\.[0-9a-f-]{36}$/i)) {
      const summary =
        typeof oldV === 'object' && oldV !== null && !Array.isArray(oldV)
          ? summarizeOrderItemRow(oldV as Record<string, unknown>)
          : formatScalar('', oldV)
      out.push({
        label: 'Línea de pedido eliminada',
        before: summary,
        after: '—',
      })
      continue
    }

    if (field === 'order_item.insert' && newV && typeof newV === 'object' && !Array.isArray(newV)) {
      const row = newV as Record<string, unknown>
      out.push({
        label: 'Línea de pedido añadida',
        before: '—',
        after: summarizeOrderItemRow(row),
      })
      continue
    }

    if (field === 'order.recalculate') {
      const fmtSnap = (v: unknown) => {
        if (!v || typeof v !== 'object' || Array.isArray(v)) return '—'
        const o = v as Record<string, unknown>
        const bits: string[] = []
        if (o.final_amount != null) bits.push(`Final ${formatMxCurrency(Number(o.final_amount))}`)
        if (o.invoice_amount != null) bits.push(`Factura ${formatMxCurrency(Number(o.invoice_amount))}`)
        return bits.length ? bits.join(' · ') : '—'
      }
      out.push({
        label: 'Recálculo de totales del pedido',
        before: fmtSnap(oldV),
        after: fmtSnap(newV),
      })
      continue
    }

    // Fallback: campo genérico
    const shortField = field.length > 48 ? `${field.slice(0, 46)}…` : field
    const fmtAny = (v: unknown) => {
      if (v !== null && typeof v === 'object') {
        try {
          const s = JSON.stringify(v)
          return s.length > 160 ? `${s.slice(0, 158)}…` : s
        } catch {
          return '…'
        }
      }
      return formatScalar('', v)
    }
    out.push({
      label: shortField,
      before: fmtAny(oldV),
      after: fmtAny(newV),
    })
  }

  return out
}

export function financialDeltaIsTrivial(
  fd: Record<string, number | null> | null | undefined
): boolean {
  if (!fd) return true
  const a = fd.final_amount_before
  const b = fd.final_amount_after
  if (a != null && b != null && a !== b) return false
  const i1 = fd.invoice_amount_before
  const i2 = fd.invoice_amount_after
  if (i1 != null && i2 != null && i1 !== i2) return false
  return true
}
