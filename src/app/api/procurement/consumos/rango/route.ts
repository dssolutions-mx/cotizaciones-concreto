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

/** Inclusive range max length (days). Prevents unbounded aggregation requests. */
const MAX_RANGE_DAYS = 366

function parseISODate(s: string | null): string | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.floor((b - a) / 86400000) + 1
}

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
    let plantId = searchParams.get('plant_id') || undefined
    const dateFrom = parseISODate(searchParams.get('date_from'))
    const dateTo = parseISODate(searchParams.get('date_to'))

    if (!plantId) {
      return NextResponse.json({ error: 'plant_id es requerido' }, { status: 400 })
    }
    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: 'date_from y date_to son requeridos (YYYY-MM-DD)' },
        { status: 400 }
      )
    }
    if (dateFrom > dateTo) {
      return NextResponse.json({ error: 'date_from no puede ser mayor que date_to' }, { status: 400 })
    }

    const span = daysBetweenInclusive(dateFrom, dateTo)
    if (span > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `El rango máximo es ${MAX_RANGE_DAYS} días` },
        { status: 400 }
      )
    }

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      plantId = profile.plant_id
    }

    const global = isGlobalInventoryRole(profile.role) || profile.role === 'SALES_AGENT'
    if (!global && plantId !== profile.plant_id) {
      return NextResponse.json({ error: 'No tiene acceso a esta planta' }, { status: 403 })
    }

    const { data: plantRow, error: plantErr } = await supabase
      .from('plants')
      .select('id, name')
      .eq('id', plantId)
      .maybeSingle()

    if (plantErr || !plantRow) {
      return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 })
    }

    const plantName = plantRow.name || 'Planta'

    const { data: summaryRows, error: sumErr } = await supabase.rpc('procurement_plant_consumption_range_summary', {
      p_plant_id: plantId,
      p_from: dateFrom,
      p_to: dateTo,
    })

    if (sumErr) {
      console.error('[procurement/consumos/rango] summary rpc', sumErr)
      return NextResponse.json({ error: sumErr.message }, { status: 500 })
    }

    const { data: byDayRows, error: dayErr } = await supabase.rpc('procurement_plant_consumption_by_day', {
      p_plant_id: plantId,
      p_from: dateFrom,
      p_to: dateTo,
    })

    if (dayErr) {
      console.error('[procurement/consumos/rango] by_day rpc', dayErr)
      return NextResponse.json({ error: dayErr.message }, { status: 500 })
    }

    const { count: remisionCount, error: countErr } = await supabase
      .from('remisiones')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', plantId)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)

    if (countErr) {
      console.warn('[procurement/consumos/rango] remision count', countErr)
    }

    const materials = (summaryRows || []).map(
      (row: {
        material_key: string
        material_id: string | null
        material_name: string
        consumption_kg: number | string | null
        entries_kg: number | string | null
        adjustments_kg: number | string | null
      }) => ({
        material_key: row.material_key,
        material_id: row.material_id,
        material_name: row.material_name,
        consumption_kg: Number(row.consumption_kg) || 0,
        entries_kg: Number(row.entries_kg) || 0,
        adjustments_kg: Number(row.adjustments_kg) || 0,
      })
    )

    materials.sort((a, b) => a.material_name.localeCompare(b.material_name, 'es'))

    const total_consumption_kg = materials.reduce((s, m) => s + m.consumption_kg, 0)
    const total_entries_kg = materials.reduce((s, m) => s + m.entries_kg, 0)
    const total_adjustments_kg = materials.reduce((s, m) => s + m.adjustments_kg, 0)

    const dailySeries = (byDayRows || []).map(
      (row: { fecha: string; consumption_kg: number | string | null }) => ({
        fecha: row.fecha,
        consumption_kg: Number(row.consumption_kg) || 0,
      })
    )

    return NextResponse.json({
      success: true,
      data: {
        plant_id: plantId,
        plant_name: plantName,
        date_from: dateFrom,
        date_to: dateTo,
        max_range_days: MAX_RANGE_DAYS,
        summary: {
          total_consumption_kg,
          total_entries_kg,
          total_adjustments_kg,
          remision_count: remisionCount ?? 0,
          material_rows: materials.length,
        },
        materials,
        daily_series: dailySeries,
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[procurement/consumos/rango]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
