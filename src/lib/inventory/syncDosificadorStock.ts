import type { SupabaseClient } from '@supabase/supabase-js'
import { InventoryDashboardService } from '@/services/inventoryDashboardService'
import { MATERIAL_LEDGER_EPSILON_KG } from '@/types/materialLedger'
import type {
  DosificadorSyncAnalysis,
  DosificadorSyncApplyResult,
  DosificadorSyncPlanItem,
  DosificadorSyncSkippedRow,
} from '@/types/materialLedger'

export type AnalyzeDosificadorSyncParams = {
  plantId: string
  startDate: string
  endDate: string
  qtyEpsilonKg?: number
}

export type ExplicitDosificadorTarget = {
  material_id: string
  target_stock_kg: number
  material_name?: string
}

export type ApplyDosificadorSyncParams = {
  plantId: string
  items: DosificadorSyncPlanItem[]
  materialIds?: string[]
  /** Ledger audit: align to flow.theoretical_final_stock without re-analyzing */
  explicitTargets?: ExplicitDosificadorTarget[]
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * Bulk alignment plan: same arithmetic as material-ledger / variances
 * (InventoryDashboardService.calculateHistoricalInventory), not reconciled_stock.
 */
export async function analyzeDosificadorSync(
  supabase: SupabaseClient,
  params: AnalyzeDosificadorSyncParams,
): Promise<DosificadorSyncAnalysis> {
  const eps = params.qtyEpsilonKg ?? MATERIAL_LEDGER_EPSILON_KG
  const dash = new InventoryDashboardService(supabase)

  let flows: Awaited<ReturnType<InventoryDashboardService['calculateHistoricalInventory']>> = []
  try {
    flows = await dash.calculateHistoricalInventory(
      params.plantId,
      params.startDate,
      params.endDate,
    )
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : 'No se pudo calcular teórico aritmético del periodo',
    )
  }

  if (flows.length === 0) {
    return {
      plant_id: params.plantId,
      date_range: { start: params.startDate, end: params.endDate },
      items: [],
      skipped: [],
      already_aligned_count: 0,
    }
  }

  const materialIds = flows.map((f) => f.material_id)

  const { data: invRows, error: invErr } = await supabase
    .from('material_inventory')
    .select('material_id, current_stock')
    .eq('plant_id', params.plantId)
    .in('material_id', materialIds)

  if (invErr) throw new Error(invErr.message)

  const liveById = new Map(
    (invRows ?? []).map((r) => [String(r.material_id), num(r.current_stock)]),
  )

  const { data: materialsMeta, error: metaErr } = await supabase
    .from('materials')
    .select('id, material_name, material_code')
    .in('id', materialIds)

  if (metaErr) throw new Error(metaErr.message)

  const metaById = new Map(
    (materialsMeta ?? []).map((m) => [
      String(m.id),
      { name: m.material_name as string, code: (m.material_code as string | null) ?? null },
    ]),
  )

  const items: DosificadorSyncPlanItem[] = []
  const skipped: DosificadorSyncSkippedRow[] = []
  let alreadyAlignedCount = 0

  for (const flow of flows) {
    const meta = metaById.get(flow.material_id)
    const name = meta?.name ?? flow.material_name
    const code = meta?.code ?? null
    const target = num(flow.theoretical_final_stock)

    if (!Number.isFinite(target)) {
      skipped.push({
        material_id: flow.material_id,
        material_name: name,
        reason: 'Sin teórico aritmético en el rango',
      })
      continue
    }

    const live = liveById.get(flow.material_id) ?? num(flow.actual_current_stock)
    const delta = target - live

    if (Math.abs(delta) < eps) {
      alreadyAlignedCount += 1
      continue
    }

    items.push({
      material_id: flow.material_id,
      material_name: name,
      material_code: code,
      live_stock_kg: live,
      target_stock_kg: target,
      delta_kg: delta,
      target_source: 'theoretical',
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
  const eps = MATERIAL_LEDGER_EPSILON_KG
  const idSet =
    params.materialIds && params.materialIds.length > 0
      ? new Set(params.materialIds)
      : null

  let toApply: DosificadorSyncPlanItem[]

  if (params.explicitTargets?.length) {
    const ids = params.explicitTargets.map((t) => t.material_id)
    const { data: invRows, error: invErr } = await supabase
      .from('material_inventory')
      .select('material_id, current_stock')
      .eq('plant_id', params.plantId)
      .in('material_id', ids)

    if (invErr) throw new Error(invErr.message)

    const liveById = new Map(
      (invRows ?? []).map((r) => [String(r.material_id), num(r.current_stock)]),
    )

    toApply = params.explicitTargets
      .map((t) => {
        const live = liveById.get(t.material_id) ?? 0
        const target = num(t.target_stock_kg)
        return {
          material_id: t.material_id,
          material_name: t.material_name ?? t.material_id,
          material_code: null,
          live_stock_kg: live,
          target_stock_kg: target,
          delta_kg: target - live,
          target_source: 'theoretical' as const,
        }
      })
      .filter((i) => Math.abs(i.delta_kg) >= eps)
  } else {
    toApply = params.items
  }

  if (idSet) {
    toApply = toApply.filter((i) => idSet.has(i.material_id))
  }

  const updated: DosificadorSyncPlanItem[] = []
  const failed: DosificadorSyncApplyResult['failed'] = []
  const now = new Date().toISOString()

  for (const item of toApply) {
    const { data, error } = await supabase
      .from('material_inventory')
      .update({ current_stock: item.target_stock_kg, updated_at: now })
      .eq('plant_id', params.plantId)
      .eq('material_id', item.material_id)
      .select('id')

    if (error) {
      failed.push({
        material_id: item.material_id,
        material_name: item.material_name,
        error: error.message,
      })
      continue
    }
    if (!data?.length) {
      const { data: inserted, error: insertErr } = await supabase
        .from('material_inventory')
        .insert({
          plant_id: params.plantId,
          material_id: item.material_id,
          current_stock: item.target_stock_kg,
          minimum_stock: 0,
          updated_at: now,
        })
        .select('id')

      if (insertErr || !inserted?.length) {
        failed.push({
          material_id: item.material_id,
          material_name: item.material_name,
          error:
            insertErr?.message ?? 'No existe fila en material_inventory para esta planta/material',
        })
        continue
      }
    }
    updated.push(item)
  }

  return { updated, failed }
}
