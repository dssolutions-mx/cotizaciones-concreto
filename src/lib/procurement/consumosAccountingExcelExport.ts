import { format } from 'date-fns'
import type { LedgerAuditAdjustmentTotals } from '@/lib/inventory/ledgerAuditPeriodTotals'
import type { MaterialFlowSummary } from '@/types/inventory'

/** Matches GET /api/procurement/consumos `data` payload used for export. */
export type ConsumosAccountingExcelPayload =
    | {
      mode: 'single'
      plant_id: string
      plant_name: string
      summary: ConsumosAccountingSummary
      materials: ConsumosAccountingMaterialBlock[]
      /** Puente inventario teórico (mismo modelo que dashboard). */
      material_flows?: MaterialFlowSummary[]
      /** Ajustes periodo fusionados como en Auditoría de material (OPEN/ADJP); alinea columnas Ajustes ± con el pie del libro mayor. */
      material_ledger_adjustments?: Record<string, LedgerAuditAdjustmentTotals>
    }
  | {
      mode: 'all'
      date: string
      plants: Array<{
        plant_id: string
        plant_name: string
        summary: ConsumosAccountingSummary
        materials: ConsumosAccountingMaterialBlock[]
      }>
    }
  | {
      mode: 'range'
      plant_id: string
      plant_name: string
      date_from: string
      date_to: string
      accounting_concept: string | null
      warehouse_number: number | null
      days: Array<{
        date: string
        summary: ConsumosAccountingSummary
        materials: ConsumosAccountingMaterialBlock[]
      }>
      /** Puente inventario teórico por material (`InventoryDashboardService.calculateHistoricalInventory`). */
      material_flows?: MaterialFlowSummary[]
      material_ledger_adjustments?: Record<string, LedgerAuditAdjustmentTotals>
    }

export type ConsumosAccountingSummary = {
  date: string
  plant_name: string
  total_consumption_kg: number
  /** Desperdicios registrados en tabla waste_materials (Arkik / tickets sin remisión persistida). */
  total_waste_arkik_kg: number
  /** Ajustes de inventario con tipo «merma» (material_adjustments.adjustment_type = waste). */
  total_merma_inventario_kg: number
  total_entries_kg: number
  /**
   * Suma de magnitudes de auditoría por línea de ajuste (incluye merma): |efecto en inventario|, salvo **aperturas de saldo**
   * donde se usa el mismo kg que «Valor en reporte» (saldo después del conteo).
   */
  total_adjustments_kg: number
  /** Suma algebraica del efecto en inventario: Σ cambio neto con signo (+ aumento, − disminución). */
  total_adjustments_net_effect_kg: number
  remision_count: number
  accounting_concept?: string | null
  warehouse_number?: number | null
}

export type ConsumosAccountingMaterialBlock = {
  material_id: string
  material_name: string
  material_accounting_code?: string | null
  total_consumed_kg: number
  consumptions: Array<{
    remision_id: string
    remision_number: string
    cantidad_teorica: number
    cantidad_real: number
    ajuste: number
    hora_carga: string | null
    volumen_remision_m3?: number | null
    client_name?: string
    construction_site?: string
    recipe_code?: string
    strength_fc?: number | null
  }>
  entries: Array<{
    id: string
    entry_number: string
    quantity_received: number
    supplier_name?: string
    supplier_invoice?: string
    entry_time?: string | null
  }>
  adjustments: Array<{
    id: string
    adjustment_type: string
    quantity_adjusted: number
    /** When present, used with `reference_type` / notes for opening-batch display (saldo vs delta). */
    inventory_before?: number | null
    inventory_after?: number | null
    reference_type?: string | null
    reference_notes?: string | null
    adjustment_time?: string | null
  }>
  /** Líneas de waste_materials (no pasan por remision_materiales). */
  waste_arkik: Array<{
    id: string
    remision_number: string
    waste_amount: number
    waste_reason: string
    notes?: string | null
    material_code?: string
  }>
  total_waste_arkik_kg: number
  /** Suma de cantidades en ajustes tipo merma (waste) para este material. */
  total_merma_inventario_kg: number
}

export function* eachPlantScope(payload: ConsumosAccountingExcelPayload): Generator<{
  plant_id: string
  plant_name: string
  summary: ConsumosAccountingSummary
  materials: ConsumosAccountingMaterialBlock[]
}> {
  if (payload.mode === 'single') {
    yield {
      plant_id: payload.plant_id,
      plant_name: payload.plant_name,
      summary: payload.summary,
      materials: payload.materials,
    }
    return
  }
  if (payload.mode === 'range') {
    for (const day of payload.days) {
      yield {
        plant_id: payload.plant_id,
        plant_name: payload.plant_name,
        summary: day.summary,
        materials: day.materials,
      }
    }
    return
  }
  for (const p of payload.plants) {
    yield {
      plant_id: p.plant_id,
      plant_name: p.plant_name,
      summary: p.summary,
      materials: p.materials,
    }
  }
}

function movementDate(payload: ConsumosAccountingExcelPayload): string {
  if (payload.mode === 'single') return payload.summary.date
  if (payload.mode === 'all') return payload.date
  return `${payload.date_from}_${payload.date_to}`
}

export function consumosAccountingExcelFilename(
  payload: ConsumosAccountingExcelPayload,
  opts?: { generatedAt?: Date },
): string {
  const gen = opts?.generatedAt ?? new Date()
  const stamp = format(gen, 'yyyyMMdd_HHmm')
  const safePlanta = (name: string) => name.replace(/[^\w\-]+/g, '_').slice(0, 36)

  if (payload.mode === 'single') {
    const slug = safePlanta(payload.plant_name)
    const fecha = format(new Date(`${payload.summary.date}T12:00:00`), 'dd-MM-yyyy')
    return `Reporte_Consumos_Materiales_${slug}_${fecha}_${stamp}.xlsx`
  }
  if (payload.mode === 'range') {
    const slug = safePlanta(payload.plant_name)
    const df = format(new Date(`${payload.date_from}T12:00:00`), 'dd-MM-yyyy')
    const dt = format(new Date(`${payload.date_to}T12:00:00`), 'dd-MM-yyyy')
    return `Reporte_Consumos_Materiales_${slug}_${df}_al_${dt}_${stamp}.xlsx`
  }

  const d = movementDate(payload)
  return `Reporte_Consumos_Materiales_Todas_plantas_${d}_${stamp}.xlsx`
}
