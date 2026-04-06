import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isGlobalInventoryRole } from '@/lib/auth/inventoryRoles'

const FINANZAS_PROCUREMENT_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'SALES_AGENT',
] as const

type RemisionesEmbed = {
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

type RemisionMaterialRow = {
  material_id: string | null
  material_type: string | null
  cantidad_teorica: number | string | null
  cantidad_real: number | string | null
  ajuste: number | string | null
  remisiones: RemisionesEmbed
  materials: { material_name: string | null; category: string | null } | null
}

type EntryRow = {
  id: string
  material_id: string
  quantity_received: number | string | null
  entry_time: string | null
  entry_number: string
  supplier_invoice: string | null
  /** Disambiguates material_entries → suppliers (supplier_id vs fleet_supplier_id) */
  supplier: { name: string | null } | null
  materials: { material_name: string | null } | null
}

type AdjustmentRow = {
  id: string
  material_id: string
  quantity_adjusted: number | string | null
  adjustment_type: string
  adjustment_time: string | null
  reference_notes: string | null
  materials: { material_name: string | null } | null
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function materialLabel(
  materialId: string | null,
  materialsJoin: { material_name: string | null } | null,
  materialType: string | null
): string {
  if (materialsJoin?.material_name) return materialsJoin.material_name
  if (materialType) return materialType
  if (materialId) return materialId.slice(0, 8)
  return 'Material sin identificar'
}

type MaterialAgg = {
  material_id: string
  material_name: string
  total_consumed_kg: number
  consumptions: Array<{
    remision_id: string
    remision_number: string
    cantidad_teorica: number
    cantidad_real: number
    ajuste: number
    hora_carga: string | null
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
    reference_notes?: string | null
    adjustment_time?: string | null
  }>
}

async function fetchPlantDay(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  plantId: string,
  date: string,
  plantName: string
): Promise<{
  plant_id: string
  plant_name: string
  summary: {
    date: string
    plant_name: string
    total_consumption_kg: number
    total_entries_kg: number
    total_adjustments_kg: number
    remision_count: number
  }
  materials: MaterialAgg[]
}> {
  const { data: remisionRows } = await supabase
    .from('remisiones')
    .select('id')
    .eq('plant_id', plantId)
    .eq('fecha', date)

  const remisionIds = (remisionRows || []).map((r) => r.id)

  const [rmRes, entriesRes, adjRes] = await Promise.all([
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
            materials (material_name, category)
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
        supplier:suppliers!supplier_id (name),
        materials (material_name)
      `
      )
      .eq('plant_id', plantId)
      .eq('entry_date', date),
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
        materials (material_name)
      `
      )
      .eq('plant_id', plantId)
      .eq('adjustment_date', date),
  ])

  if (rmRes.error) throw new Error(rmRes.error.message)
  if (entriesRes.error) throw new Error(entriesRes.error.message)
  if (adjRes.error) throw new Error(adjRes.error.message)

  const rmRows = (rmRes.data || []) as RemisionMaterialRow[]
  const entryRows = (entriesRes.data || []) as EntryRow[]
  const adjRows = (adjRes.data || []) as AdjustmentRow[]

  const byMaterial = new Map<string, MaterialAgg>()
  const remisionIdSet = new Set<string>()

  for (const row of rmRows) {
    const rem = row.remisiones
    if (!rem?.id) continue
    remisionIdSet.add(rem.id)
    const mid = row.material_id || `type:${row.material_type || 'unknown'}`
    const name = materialLabel(row.material_id, row.materials, row.material_type)
    if (!byMaterial.has(mid)) {
      byMaterial.set(mid, {
        material_id: row.material_id || mid,
        material_name: name,
        total_consumed_kg: 0,
        consumptions: [],
        entries: [],
        adjustments: [],
      })
    }
    const agg = byMaterial.get(mid)!
    const real = num(row.cantidad_real)
    agg.total_consumed_kg += real
    const clientName =
      rem.order?.clients?.business_name || undefined
    const constructionSite = rem.order?.construction_site || undefined
    agg.consumptions.push({
      remision_id: rem.id,
      remision_number: rem.remision_number,
      cantidad_teorica: num(row.cantidad_teorica),
      cantidad_real: real,
      ajuste: num(row.ajuste),
      hora_carga: rem.hora_carga,
      client_name: clientName,
      construction_site: constructionSite,
      recipe_code: rem.recipe?.recipe_code || undefined,
      strength_fc: rem.recipe?.strength_fc ?? null,
    })
  }

  for (const row of entryRows) {
    const mid = row.material_id
    const name = materialLabel(mid, row.materials, null)
    if (!byMaterial.has(mid)) {
      byMaterial.set(mid, {
        material_id: mid,
        material_name: name,
        total_consumed_kg: 0,
        consumptions: [],
        entries: [],
        adjustments: [],
      })
    }
    const agg = byMaterial.get(mid)!
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
    if (!byMaterial.has(mid)) {
      byMaterial.set(mid, {
        material_id: mid,
        material_name: name,
        total_consumed_kg: 0,
        consumptions: [],
        entries: [],
        adjustments: [],
      })
    }
    const agg = byMaterial.get(mid)!
    if (agg.material_name === name || agg.material_name.length < name.length) {
      agg.material_name = name
    }
    agg.adjustments.push({
      id: row.id,
      adjustment_type: row.adjustment_type,
      quantity_adjusted: num(row.quantity_adjusted),
      reference_notes: row.reference_notes,
      adjustment_time: row.adjustment_time,
    })
  }

  const materials = Array.from(byMaterial.values()).filter(
    (m) =>
      m.consumptions.length > 0 || m.entries.length > 0 || m.adjustments.length > 0
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

  return {
    plant_id: plantId,
    plant_name: plantName,
    summary: {
      date,
      plant_name: plantName,
      total_consumption_kg,
      total_entries_kg,
      total_adjustments_kg,
      remision_count: remisionIdSet.size,
    },
    materials,
  }
}

/**
 * GET /api/procurement/consumos?date=YYYY-MM-DD&plant_id=uuid (optional for global roles)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    }

    if (!FINANZAS_PROCUREMENT_ROLES.includes(profile.role as (typeof FINANZAS_PROCUREMENT_ROLES)[number])) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : new Date().toISOString().slice(0, 10)

    let requestedPlantId = searchParams.get('plant_id') || undefined

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      requestedPlantId = profile.plant_id
    }

    const global = isGlobalInventoryRole(profile.role) || profile.role === 'SALES_AGENT'

    const { data: plantRows, error: plantsError } = await supabase
      .from('plants')
      .select('id, name')
      .eq('is_active', true)
      .order('name')

    if (plantsError) {
      return NextResponse.json({ error: plantsError.message }, { status: 500 })
    }

    const plants = plantRows || []
    const plantNameById = new Map(plants.map((p) => [p.id, p.name || 'Planta']))

    if (requestedPlantId) {
      const plantName = plantNameById.get(requestedPlantId) || 'Planta'
      const payload = await fetchPlantDay(supabase, requestedPlantId, date, plantName)
      return NextResponse.json({
        success: true,
        data: {
          mode: 'single' as const,
          ...payload,
        },
      })
    }

    if (!global) {
      return NextResponse.json(
        { error: 'Seleccione una planta para ver consumos del día.' },
        { status: 400 }
      )
    }

    const results = await Promise.all(
      plants.map((p) => fetchPlantDay(supabase, p.id, date, p.name || 'Planta'))
    )

    return NextResponse.json({
      success: true,
      data: {
        mode: 'all' as const,
        date,
        plants: results,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[procurement/consumos]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
