import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryDashboardService } from '@/services/inventoryDashboardService'
import { MATERIAL_LEDGER_EPSILON_KG } from '@/types/materialLedger'
import type {
  DosificadorSyncAnalysis,
  DosificadorSyncApplyResult,
  DosificadorSyncPlanItem,
  DosificadorSyncSkippedRow,
  DosificadorSyncTargetSource,
} from '@/types/materialLedger'

type ReconciledRow = {
  material_id: string
  dosificador_stock: number | null
  reconciled_stock: number | null
  materials: { material_name: string; material_code: string | null; is_active: boolean }
}

export type AnalyzeDosificadorSyncParams = {
  plantId: string
  startDate: string
  endDate: string
  qtyEpsilonKg?: number
}

export type ApplyDosificadorSyncParams = {
  plantId: string
  items: DosificadorSyncPlanItem[]
  materialIds?: string[]
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function analyzeDosificadorSync(
  supabase: SupabaseClient,
  params: AnalyzeDosificadorSyncParams,
): Promise<DosificadorSyncAnalysis> {
  const eps = params.qtyEpsilonKg ?? MATERIAL_LEDGER_EPSILON_KG

  const { data: rows, error: listErr } = await supabase
    .from('v_material_inventory_reconciled')
    .select(
      'material_id, dosificador_stock, reconciled_stock, materials!inner(material_name, material_code, is_active)',
    )
    .eq('plant_id', params.plantId)
    .eq('materials.is_active', true)

  if (listErr) throw new Error(listErr.message)

  const reconciledRows = (rows ?? []) as ReconciledRow[]
  const needsTheoreticalIds: string[] = []

  for (const row of reconciledRows) {
    if (row.reconciled_stock == null) {
      needsTheoreticalIds.push(row.material_id)
    }
  }

  const theoreticalByMaterial = new Map<string, number>()
  if (needsTheoreticalIds.length > 0) {
    const dash = new InventoryDashboardService(supabase)
    const flows = await dash.calculateHistoricalInventory(
      params.plantId,
      params.startDate,
      params.endDate,
      needsTheoreticalIds,
    )
    for (const f of flows) {
      theoreticalByMaterial.set(f.material_id, num(f.theoretical_final_stock))
    }
  }

  const items: DosificadorSyncPlanItem[] = []
  const skipped: DosificadorSyncSkippedRow[] = []
  let alreadyAlignedCount = 0

  for (const row of reconciledRows) {
    const name = row.materials.material_name
    const code = row.materials.material_code ?? null
    const live = num(row.dosificador_stock)

    let target: number | null = null
    let source: DosificadorSyncTargetSource | null = null

    if (row.reconciled_stock != null) {
      target = num(row.reconciled_stock)
      source = 'reconciled'
    } else {
      const theoretical = theoreticalByMaterial.get(row.material_id)
      if (theoretical != null && Number.isFinite(theoretical)) {
        target = theoretical
        source = 'theoretical'
      }
    }

    if (target == null || source == null) {
      skipped.push({
        material_id: row.material_id,
        material_name: name,
        reason: 'Sin saldo reconciliado ni teórico aritmético en el rango',
      })
      continue
    }

    const delta = target - live
    if (Math.abs(delta) < eps) {
      alreadyAlignedCount += 1
      continue
    }

    items.push({
      material_id: row.material_id,
      material_name: name,
      material_code: code,
      live_stock_kg: live,
      target_stock_kg: target,
      delta_kg: delta,
      target_source: source,
    })
  }

  items.sort((a, b) => Math.abs(b.delta_kg) - Math.abs(a.delta_kg))

  return {
    plant_id: params.plantId,
    date_range: { start: params.startDate, end: params.endDate },
    items,
    skipped,
    already_aligned_count: alreadyAlignedCount,
  }
}

export async function applyDosificadorSync(
  supabase: SupabaseClient,
  params: ApplyDosificadorSyncParams,
): Promise<DosificadorSyncApplyResult> {
  const idSet =
    params.materialIds && params.materialIds.length > 0
      ? new Set(params.materialIds)
      : null

  const toApply = params.items.filter((i) => !idSet || idSet.has(i.material_id))
  const updated: DosificadorSyncPlanItem[] = []
  const failed: DosificadorSyncApplyResult['failed'] = []
  const now = new Date().toISOString()

  for (const item of toApply) {
    const { error } = await supabase
      .from('material_inventory')
      .update({ current_stock: item.target_stock_kg, updated_at: now })
      .eq('plant_id', params.plantId)
      .eq('material_id', item.material_id)

    if (error) {
      failed.push({
        material_id: item.material_id,
        material_name: item.material_name,
        error: error.message,
      })
      continue
    }
    updated.push(item)
  }

  return { updated, failed }
}
