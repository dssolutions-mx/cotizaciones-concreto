import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isGlobalInventoryRole } from '@/lib/auth/inventoryRoles'
import {
  aggregatePlantConsumosFromRows,
  type EntryRow,
  type RemisionMaterialRow,
  type AdjustmentRow,
} from '@/lib/procurement/plantConsumosAggregate'

const FINANZAS_PROCUREMENT_ROLES = [
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'SALES_AGENT',
] as const

async function fetchPlantDay(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  plantId: string,
  date: string,
  plantName: string,
  plantAccounting: { accounting_concept: string | null; warehouse_number: number | null }
): Promise<ReturnType<typeof aggregatePlantConsumosFromRows>> {
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
        supplier:suppliers!supplier_id (name),
        materials (material_name, accounting_code)
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
        materials (material_name, accounting_code)
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

  return aggregatePlantConsumosFromRows(plantId, plantName, date, plantAccounting, rmRows, entryRows, adjRows)
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
      .select('id, name, accounting_concept, warehouse_number')
      .eq('is_active', true)
      .order('name')

    if (plantsError) {
      return NextResponse.json({ error: plantsError.message }, { status: 500 })
    }

    type PlantRow = {
      id: string
      name: string | null
      accounting_concept: string | null
      warehouse_number: number | null
    }
    const plants = (plantRows || []) as PlantRow[]
    const plantNameById = new Map(plants.map((p) => [p.id, p.name || 'Planta']))
    const plantAccountingById = new Map(
      plants.map((p) => [
        p.id,
        {
          accounting_concept: p.accounting_concept ?? null,
          warehouse_number:
            p.warehouse_number != null && Number.isFinite(Number(p.warehouse_number))
              ? Number(p.warehouse_number)
              : null,
        },
      ])
    )

    if (requestedPlantId) {
      const plantName = plantNameById.get(requestedPlantId) || 'Planta'
      const acct =
        plantAccountingById.get(requestedPlantId) ?? {
          accounting_concept: null,
          warehouse_number: null,
        }
      const payload = await fetchPlantDay(supabase, requestedPlantId, date, plantName, acct)
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
      plants.map((p) =>
        fetchPlantDay(
          supabase,
          p.id,
          date,
          p.name || 'Planta',
          plantAccountingById.get(p.id) ?? { accounting_concept: null, warehouse_number: null }
        )
      )
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
