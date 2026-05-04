import type { SupabaseClient } from '@supabase/supabase-js'
import type { ConsumosAccountingMaterialBlock, ConsumosAccountingSummary } from '@/lib/procurement/consumosAccountingExcelExport'

export type RemisionesEmbed = {
  id: string
  remision_number: string
  hora_carga: string | null
  volumen_fabricado: number | null
  fecha: string
  order: {
    construction_site: string | null
    clients: { business_name: string | null } | null
  } | null
  recipe: { recipe_code: string | null; strength_fc: number | null } | null
} | null

export type RemisionMaterialRow = {
  material_id: string | null
  material_type: string | null
  cantidad_teorica: number | string | null
  cantidad_real: number | string | null
  ajuste: number | string | null
  remisiones: RemisionesEmbed
  materials: {
    material_name: string | null
    category: string | null
    accounting_code: string | null
  } | null
}

export type EntryRow = {
  id: string
  material_id: string
  quantity_received: number | string | null
  entry_time: string | null
  entry_number: string
  supplier_invoice: string | null
  /** Present when fetched for range bucketing */
  entry_date?: string
  supplier: { name: string | null } | null
  materials: { material_name: string | null; accounting_code: string | null } | null
}

export type AdjustmentRow = {
  id: string
  material_id: string
  quantity_adjusted: number | string | null
  adjustment_type: string
  adjustment_time: string | null
  reference_notes: string | null
  /** Present when fetched for range bucketing */
  adjustment_date?: string
  materials: { material_name: string | null; accounting_code: string | null } | null
}

/** Filas de `waste_materials` (desperdicio Arkik / tickets sin consumo en remision_materiales). */
export type WasteMaterialRow = {
  id: string
  plant_id: string
  fecha: string
  remision_number: string
  material_code: string
  material_id: string | null
  material_name?: string | null
  waste_amount: number | string | null
  waste_reason: string
  notes: string | null
  materials: { material_name: string | null; accounting_code: string | null } | null
}

export type MaterialAgg = ConsumosAccountingMaterialBlock

const MERMA_ADJUSTMENT_TYPE = 'waste' as const

function wasteMaterialLabel(row: WasteMaterialRow): string {
  const joined = row.materials?.material_name?.trim()
  if (joined) return joined
  const n = row.material_name?.trim()
  if (n) return n
  if (row.material_code) return row.material_code
  return 'Material sin identificar'
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function materialLabel(
  materialId: string | null,
  materialsJoin: { material_name: string | null } | null,
  materialType: string | null
): string {
  if (materialsJoin?.material_name) return materialsJoin.material_name
  if (materialType) return materialType
  if (materialId) return materialId.slice(0, 8)
  return 'Material sin identificar'
}

export function materialAccountingCode(materialsJoin: { accounting_code?: string | null } | null): string | null {
  const c = materialsJoin?.accounting_code?.trim()
  return c || null
}

/**
 * Same aggregation as consumo diario API — builds materials + summary for one calendar day.
 */
export function aggregatePlantConsumosFromRows(
  plantId: string,
  plantName: string,
  date: string,
  plantAccounting: { accounting_concept: string | null; warehouse_number: number | null },
  rmRows: RemisionMaterialRow[],
  entryRows: EntryRow[],
  adjRows: AdjustmentRow[],
  wasteRows: WasteMaterialRow[] = [],
): {
  plant_id: string
  plant_name: string
  summary: ConsumosAccountingSummary
  materials: MaterialAgg[]
} {
  type InnerAgg = {
    material_id: string
    material_name: string
    material_accounting_code: string | null
    total_consumed_kg: number
    consumptions: MaterialAgg['consumptions']
    entries: MaterialAgg['entries']
    adjustments: MaterialAgg['adjustments']
    waste_arkik: MaterialAgg['waste_arkik']
    total_waste_arkik_kg: number
    total_merma_inventario_kg: number
  }

  const byMaterial = new Map<string, InnerAgg>()
  const remisionIdSet = new Set<string>()

  function ensureMaterial(mid: string, init: Omit<InnerAgg, 'consumptions' | 'entries' | 'adjustments' | 'waste_arkik' | 'total_waste_arkik_kg' | 'total_merma_inventario_kg'> & Partial<Pick<InnerAgg, 'total_consumed_kg'>>): InnerAgg {
    let agg = byMaterial.get(mid)
    if (!agg) {
      agg = {
        material_id: init.material_id,
        material_name: init.material_name,
        material_accounting_code: init.material_accounting_code,
        total_consumed_kg: init.total_consumed_kg ?? 0,
        consumptions: [],
        entries: [],
        adjustments: [],
        waste_arkik: [],
        total_waste_arkik_kg: 0,
        total_merma_inventario_kg: 0,
      }
      byMaterial.set(mid, agg)
    }
    return agg
  }

  for (const row of rmRows) {
    const rem = row.remisiones
    if (!rem?.id) continue
    remisionIdSet.add(rem.id)
    const mid = row.material_id || `type:${row.material_type || 'unknown'}`
    const name = materialLabel(row.material_id, row.materials, row.material_type)
    const accCode = materialAccountingCode(row.materials)
    const agg = ensureMaterial(mid, {
      material_id: row.material_id || mid,
      material_name: name,
      material_accounting_code: accCode,
      total_consumed_kg: 0,
    })
    if (!agg.material_accounting_code && accCode) {
      agg.material_accounting_code = accCode
    }
    const real = num(row.cantidad_real)
    agg.total_consumed_kg += real
    const clientName = rem.order?.clients?.business_name || undefined
    const constructionSite = rem.order?.construction_site || undefined
    agg.consumptions.push({
      remision_id: rem.id,
      remision_number: rem.remision_number,
      cantidad_teorica: num(row.cantidad_teorica),
      cantidad_real: real,
      ajuste: num(row.ajuste),
      hora_carga: rem.hora_carga,
      volumen_remision_m3:
        rem.volumen_fabricado != null && Number.isFinite(Number(rem.volumen_fabricado))
          ? Number(rem.volumen_fabricado)
          : null,
      client_name: clientName,
      construction_site: constructionSite,
      recipe_code: rem.recipe?.recipe_code || undefined,
      strength_fc: rem.recipe?.strength_fc ?? null,
    })
  }

  for (const row of entryRows) {
    const mid = row.material_id
    const name = materialLabel(mid, row.materials, null)
    const accCode = materialAccountingCode(row.materials)
    const agg = ensureMaterial(mid, {
      material_id: mid,
      material_name: name,
      material_accounting_code: accCode,
      total_consumed_kg: 0,
    })
    if (!agg.material_accounting_code && accCode) {
      agg.material_accounting_code = accCode
    }
    if (agg.material_name === name || agg.material_name.length < name.length) {
      agg.material_name = name
    }
    const qty = num(row.quantity_received)
    agg.entries.push({
      id: row.id,
      entry_number: row.entry_number,
      quantity_received: qty,
      supplier_name: row.supplier?.name || undefined,
      supplier_invoice: row.supplier_invoice || undefined,
      entry_time: row.entry_time,
    })
  }

  for (const row of adjRows) {
    const mid = row.material_id
    const name = materialLabel(mid, row.materials, null)
    const accCode = materialAccountingCode(row.materials)
    const agg = ensureMaterial(mid, {
      material_id: mid,
      material_name: name,
      material_accounting_code: accCode,
      total_consumed_kg: 0,
    })
    if (!agg.material_accounting_code && accCode) {
      agg.material_accounting_code = accCode
    }
    if (agg.material_name === name || agg.material_name.length < name.length) {
      agg.material_name = name
    }
    const qtyAdj = num(row.quantity_adjusted)
    agg.adjustments.push({
      id: row.id,
      adjustment_type: row.adjustment_type,
      quantity_adjusted: qtyAdj,
      reference_notes: row.reference_notes,
      adjustment_time: row.adjustment_time,
    })
    if (row.adjustment_type === MERMA_ADJUSTMENT_TYPE) {
      agg.total_merma_inventario_kg += Math.abs(qtyAdj)
    }
  }

  for (const row of wasteRows) {
    const mid = row.material_id || `code:${row.material_code}`
    const name = wasteMaterialLabel(row)
    const accCode = materialAccountingCode(row.materials)
    const agg = ensureMaterial(mid, {
      material_id: row.material_id || mid,
      material_name: name,
      material_accounting_code: accCode,
      total_consumed_kg: 0,
    })
    if (!agg.material_accounting_code && accCode) {
      agg.material_accounting_code = accCode
    }
    if (agg.material_name === name || agg.material_name.length < name.length) {
      agg.material_name = name
    }
    const wa = num(row.waste_amount)
    agg.waste_arkik.push({
      id: row.id,
      remision_number: row.remision_number,
      waste_amount: wa,
      waste_reason: row.waste_reason,
      notes: row.notes,
      material_code: row.material_code,
    })
    agg.total_waste_arkik_kg += wa
  }

  const materials = Array.from(byMaterial.values()).filter(
    (m) =>
      m.consumptions.length > 0 ||
      m.entries.length > 0 ||
      m.adjustments.length > 0 ||
      m.waste_arkik.length > 0
  )
  materials.sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'))

  const total_consumption_kg = materials.reduce((s, m) => s + m.total_consumed_kg, 0)
  const total_entries_kg = materials.reduce(
    (s, m) => s + m.entries.reduce((t, e) => t + e.quantity_received, 0),
    0
  )
  const total_adjustments_kg = materials.reduce(
    (s, m) => s + m.adjustments.reduce((t, a) => t + Math.abs(a.quantity_adjusted), 0),
    0
  )
  const total_waste_arkik_kg = materials.reduce((s, m) => s + m.total_waste_arkik_kg, 0)
  const total_merma_inventario_kg = materials.reduce((s, m) => s + m.total_merma_inventario_kg, 0)

  const materialsOut: MaterialAgg[] = materials.map((m) => ({
    material_id: m.material_id,
    material_name: m.material_name,
    material_accounting_code: m.material_accounting_code,
    total_consumed_kg: m.total_consumed_kg,
    consumptions: m.consumptions,
    entries: m.entries,
    adjustments: m.adjustments,
    waste_arkik: m.waste_arkik,
    total_waste_arkik_kg: m.total_waste_arkik_kg,
    total_merma_inventario_kg: m.total_merma_inventario_kg,
  }))

  return {
    plant_id: plantId,
    plant_name: plantName,
    summary: {
      date,
      plant_name: plantName,
      total_consumption_kg,
      total_waste_arkik_kg,
      total_merma_inventario_kg,
      total_entries_kg,
      total_adjustments_kg,
      remision_count: remisionIdSet.size,
      accounting_concept: plantAccounting.accounting_concept,
      warehouse_number: plantAccounting.warehouse_number,
    },
    materials: materialsOut,
  }
}

function ymdFromDbDate(d: string | null | undefined): string | null {
  if (!d) return null
  const s = String(d)
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null
}

function iterateDatesInclusive(from: string, to: string): string[] {
  const out: string[] = []
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  for (let t = a; t <= b; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10))
  }
  return out
}

type DayBucket = {
  rm: RemisionMaterialRow[]
  entries: EntryRow[]
  adj: AdjustmentRow[]
  waste: WasteMaterialRow[]
}

/**
 * Batched detail for a plant over [dateFrom, dateTo] — one materials snapshot per day with movement.
 */
export async function fetchPlantConsumosRangeDays(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string,
  plantName: string,
  plantAccounting: { accounting_concept: string | null; warehouse_number: number | null }
): Promise<
  Array<{
    date: string
    summary: ConsumosAccountingSummary
    materials: MaterialAgg[]
  }>
> {
  const { data: remisionRows, error: remErr } = await supabase
    .from('remisiones')
    .select('id, fecha')
    .eq('plant_id', plantId)
    .gte('fecha', dateFrom)
    .lte('fecha', dateTo)

  if (remErr) throw new Error(remErr.message)

  const remisionIds = (remisionRows || []).map((r) => r.id)

  const [rmRes, entriesRes, adjRes, wasteRes] = await Promise.all([
    remisionIds.length === 0
      ? Promise.resolve({ data: [] as RemisionMaterialRow[], error: null })
      : supabase
          .from('remision_materiales')
          .select(
            `
            material_id,
            material_type,
            cantidad_teorica,
            cantidad_real,
            ajuste,
            remision_id,
            remisiones (
              id,
              remision_number,
              hora_carga,
              volumen_fabricado,
              fecha,
              order:orders (
                construction_site,
                clients:clients (business_name)
              ),
              recipe:recipes (recipe_code, strength_fc)
            ),
            materials (material_name, category, accounting_code)
          `
          )
          .in('remision_id', remisionIds),
    supabase
      .from('material_entries')
      .select(
        `
        id,
        material_id,
        quantity_received,
        entry_time,
        entry_number,
        supplier_invoice,
        entry_date,
        supplier:suppliers!supplier_id (name),
        materials (material_name, accounting_code)
      `
      )
      .eq('plant_id', plantId)
      .gte('entry_date', dateFrom)
      .lte('entry_date', dateTo),
    supabase
      .from('material_adjustments')
      .select(
        `
        id,
        material_id,
        quantity_adjusted,
        adjustment_type,
        adjustment_time,
        reference_notes,
        adjustment_date,
        materials (material_name, accounting_code)
      `
      )
      .eq('plant_id', plantId)
      .gte('adjustment_date', dateFrom)
      .lte('adjustment_date', dateTo),
    supabase
      .from('waste_materials')
      .select(
        `
        id,
        plant_id,
        fecha,
        remision_number,
        material_code,
        material_id,
        material_name,
        waste_amount,
        waste_reason,
        notes,
        materials (material_name, accounting_code)
      `
      )
      .eq('plant_id', plantId)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo),
  ])

  if (rmRes.error) throw new Error(rmRes.error.message)
  if (entriesRes.error) throw new Error(entriesRes.error.message)
  if (adjRes.error) throw new Error(adjRes.error.message)
  if (wasteRes.error) throw new Error(wasteRes.error.message)

  const rmRowsAll = (rmRes.data || []) as RemisionMaterialRow[]
  const entryRowsAll = (entriesRes.data || []) as unknown as EntryRow[]
  const adjRowsAll = (adjRes.data || []) as unknown as AdjustmentRow[]
  const wasteRowsAll = (wasteRes.data || []) as unknown as WasteMaterialRow[]

  const byDate = new Map<string, DayBucket>()
  const ensure = (d: string): DayBucket => {
    let b = byDate.get(d)
    if (!b) {
      b = { rm: [], entries: [], adj: [], waste: [] }
      byDate.set(d, b)
    }
    return b
  }

  for (const row of rmRowsAll) {
    const rem = row.remisiones
    const d = ymdFromDbDate(rem?.fecha ?? null)
    if (!d) continue
    ensure(d).rm.push(row)
  }

  for (const row of entryRowsAll) {
    const d = ymdFromDbDate(row.entry_date ?? null)
    if (!d) continue
    ensure(d).entries.push(row)
  }

  for (const row of adjRowsAll) {
    const d = ymdFromDbDate(row.adjustment_date ?? null)
    if (!d) continue
    ensure(d).adj.push(row)
  }

  for (const row of wasteRowsAll) {
    const d = ymdFromDbDate(row.fecha ?? null)
    if (!d) continue
    ensure(d).waste.push(row)
  }

  const daysOut: Array<{ date: string; summary: ConsumosAccountingSummary; materials: MaterialAgg[] }> = []

  for (const date of iterateDatesInclusive(dateFrom, dateTo)) {
    const b = byDate.get(date)
    if (!b) continue
    const { summary, materials } = aggregatePlantConsumosFromRows(
      plantId,
      plantName,
      date,
      plantAccounting,
      b.rm,
      b.entries,
      b.adj,
      b.waste,
    )
    if (materials.length === 0) continue
    daysOut.push({ date, summary, materials })
  }

  return daysOut
}
