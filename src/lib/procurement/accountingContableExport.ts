import type { MaterialEntry } from '@/types/inventory'
import { entryQuantityKg, entryUnitPricePerKg } from '@/lib/procurement/accountingEntryMetrics'

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

/**
 * Filas para Excel contable: columnas en el orden requerido por el sistema de carga.
 * Solo las columnas contables (sin columnas extra) para no desalinear el layout del ERP.
 */
export function reviewedEntriesToAccountingContableRows(entries: MaterialEntry[]) {
  return entries.map((e) => {
    const qtyKg = entryQuantityKg(e)
    const priceKg = entryUnitPricePerKg(e)
    const plant = plantSlice(e)

    const row: Record<string, string | number | null> = {
      fecha: e.entry_date || '',
      clave_de_producto: materialCode(e),
      serie: ACCOUNTING_EXPORT_SERIE,
      folio_factura: (e.supplier_invoice || '').trim(),
      precio_unitario: priceKg != null && Number.isFinite(priceKg) ? Number(priceKg.toFixed(6)) : '',
      cantidad: qtyKg != null && Number.isFinite(qtyKg) ? Number(qtyKg.toFixed(4)) : '',
      concepto: (plant.accounting_concept || '').trim(),
      almacen: plant.warehouse_number != null ? plant.warehouse_number : '',
    }

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
