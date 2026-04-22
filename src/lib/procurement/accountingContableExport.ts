import type { MaterialEntry } from '@/types/inventory'
import {
  entryContableCantidad,
  entryContablePrecioUnitario,
} from '@/lib/inventory/materialEntryContableMetrics'

/** Serie fiscal artificial para layout contable (constante por ahora). */
export const ACCOUNTING_EXPORT_SERIE = 'ZFE'

export type PlantAccountingSlice = {
  accounting_concept?: string | null
  warehouse_number?: number | null
}

type MaterialWithCode = NonNullable<MaterialEntry['material']> & {
  accounting_code?: string | null
}

function plantSlice(e: MaterialEntry): PlantAccountingSlice {
  const p = e.plant as
    | (PlantAccountingSlice & { accounting_concept?: string | null; warehouse_number?: number | null })
    | null
    | undefined
  return {
    accounting_concept: p?.accounting_concept ?? null,
    warehouse_number:
      p?.warehouse_number != null && Number.isFinite(Number(p.warehouse_number))
        ? Number(p.warehouse_number)
        : null,
  }
}

function materialCode(e: MaterialEntry): string {
  const m = e.material as MaterialWithCode | undefined
  const code = m?.accounting_code?.trim()
  return code || ''
}

function contableRowValues(e: MaterialEntry) {
  const qty = entryContableCantidad(e)
  const price = entryContablePrecioUnitario(e)
  const plant = plantSlice(e)
  return {
    fecha: e.entry_date || '',
    clave_de_producto: materialCode(e),
    serie: ACCOUNTING_EXPORT_SERIE,
    folio_factura: (e.supplier_invoice || '').trim(),
    precio_unitario: price != null && Number.isFinite(price) ? Number(price.toFixed(6)) : '',
    cantidad: qty != null && Number.isFinite(qty) ? Number(qty.toFixed(4)) : '',
    concepto: (plant.accounting_concept || '').trim(),
    almacen: plant.warehouse_number != null ? plant.warehouse_number : '',
  }
}

/**
 * Filas para Excel contable: columnas en el orden requerido por el sistema de carga.
 */
export function reviewedEntriesToAccountingContableRows(entries: MaterialEntry[]) {
  return entries.map((e) => {
    const v = contableRowValues(e)
    const row: Record<string, string | number> = { ...v }
    return row
  })
}

/** Encabezados en orden fijo (misma clave que el objeto de fila). */
export const ACCOUNTING_CONTABLE_COLUMN_KEYS = [
  'fecha',
  'clave_de_producto',
  'serie',
  'folio_factura',
  'precio_unitario',
  'cantidad',
  'concepto',
  'almacen',
] as const

/**
 * TSV para pegar en Excel / ERP (mismo patrón que remisiones contables).
 * Primera fila: claves de columna; separador tab.
 */
export function formatReviewedEntriesAccountingTsv(entries: MaterialEntry[]): string {
  if (!entries.length) return ''
  const keys = [...ACCOUNTING_CONTABLE_COLUMN_KEYS] as const
  const lines: string[] = [keys.join('\t')]
  for (const e of entries) {
    const v = contableRowValues(e)
    lines.push(
      keys
        .map((k) => {
          const cell = v[k as keyof typeof v]
          if (cell === null || cell === undefined) return ''
          return String(cell)
        })
        .join('\t')
    )
  }
  return lines.join('\n')
}
