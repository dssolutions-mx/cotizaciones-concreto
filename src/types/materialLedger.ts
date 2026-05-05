import type { MaterialFlowSummary, RemisionMaterialConsumption, InventoryMovement } from '@/types/inventory'

/** kg tolerance for reconciliation highlights + variance worklist */
export const MATERIAL_LEDGER_EPSILON_KG = 0.5
export const MATERIAL_LEDGER_DEFAULT_CUTOVER = '2026-04-01'
export const MATERIAL_LEDGER_MAX_RANGE_DAYS = 90

export type MaterialLedgerOpening = {
  cutover_date: string | null
  initial_count_adjustment_id: string | null
  initial_count_qty_kg: number | null
  opening_fifo_entry_id: string | null
  opening_unit_price: number | null
  opening_total_cost: number | null
}

export type MaterialLedgerReconciliation = {
  dosificador_stock_kg: number
  fifo_remaining_kg: number
  fifo_excluded_count: number
  fifo_allocation_rows: number
  accounting_received_kg: number
  accounting_total_mxn: number
  theoretical_final_kg: number
  pending_pricing_entries: number
  deltas: {
    stock_vs_theoretical: number
    stock_vs_fifo: number
    accounting_kg_vs_dosificador: number
  }
}

export type MaterialLedgerEntryRow = {
  id: string
  entry_number: string
  entry_date: string
  received_qty_kg: number | null
  received_uom: string | null
  received_qty_entered: number | null
  quantity_received: number
  unit_price: number | null
  total_cost: number | null
  pricing_status: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  landed_unit_price: number | null
  excluded_from_fifo: boolean | null
  payable_item: {
    id: string
    amount: number
    payable_id: string
  } | null
  fifo: {
    remaining_kg: number | null
    excluded_from_fifo: boolean | null
    allocations_count: number
  }
  /** Rough kg implied by payable vs entry cantidad contable */
  ap_amount_matches_total_cost: boolean
}

export type MaterialLedgerResponse = {
  success: true
  plant: { id: string; name: string; code: string | null }
  material: {
    id: string
    material_name: string
    category: string | null
    unit_of_measure: string | null
    material_code: string | null
  }
  date_range: { start: string; end: string; since_cutover: boolean }
  opening: MaterialLedgerOpening
  flow: MaterialFlowSummary | null
  movements: InventoryMovement[]
  consumption_details: RemisionMaterialConsumption[]
  reconciliation: MaterialLedgerReconciliation
  entry_rows: MaterialLedgerEntryRow[]
}

export type MaterialLedgerVarianceRow = {
  material_id: string
  material_name: string
  dosificador_stock_kg: number
  theoretical_final_kg: number | null
  stock_vs_theoretical: number | null
  fifo_remaining_kg: number | null
  fifo_vs_stock: number | null
  pending_pricing_count: number
}
