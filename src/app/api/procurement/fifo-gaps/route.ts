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

function monthBounds(ym: string): { from: string; to: string } | null {
  const m = ym.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null
  const from = `${y}-${String(mo).padStart(2, '0')}-01`
  const last = new Date(y, mo, 0)
  const to = `${y}-${String(mo).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { from, to }
}

/**
 * GET /api/procurement/fifo-gaps?month=YYYY-MM&plant_id=uuid
 * Optional: from=YYYY-MM-DD&to=YYYY-MM-DD (overrides month)
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
    const fromParam = searchParams.get('from')
    const toParam = searchParams.get('to')
    const monthParam = searchParams.get('month')

    let range: { from: string; to: string } | null = null
    if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
      range = { from: fromParam, to: toParam }
    } else if (monthParam) {
      range = monthBounds(monthParam)
    } else {
      const d = new Date()
      range = monthBounds(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    if (!range) {
      return NextResponse.json({ error: 'Rango de fechas inválido' }, { status: 400 })
    }

    let requestedPlantId = searchParams.get('plant_id') || undefined

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
      requestedPlantId = profile.plant_id
    }

    const global = isGlobalInventoryRole(profile.role) || profile.role === 'SALES_AGENT'

    if (!requestedPlantId && !global) {
      return NextResponse.json(
        { error: 'Seleccione una planta para ver huecos de costeo FIFO.' },
        { status: 400 }
      )
    }

    const { data: rows, error: rpcError } = await supabase.rpc('fn_fifo_operational_gaps', {
      p_from: range.from,
      p_to: range.to,
    })

    if (rpcError) {
      console.error('[procurement/fifo-gaps]', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    let list = rows ?? []
    if (requestedPlantId) {
      list = list.filter((r) => r.plant_id === requestedPlantId)
    }

    const gaps = list.filter((r) => !r.is_allocated)
    const reasonCounts = new Map<string, number>()
    for (const r of gaps) {
      const c = r.reason_code ?? 'UNKNOWN'
      reasonCounts.set(c, (reasonCounts.get(c) ?? 0) + 1)
    }

    const distinctPm = new Set(gaps.map((r) => `${r.plant_id}|${r.material_id}`)).size

    return NextResponse.json({
      success: true,
      data: {
        from: range.from,
        to: range.to,
        rows: list,
        summary: {
          total_lines: list.length,
          gap_lines: gaps.length,
          allocated_lines: list.length - gaps.length,
          distinct_plant_material_gaps: distinctPm,
          gap_by_reason: Object.fromEntries(reasonCounts.entries()),
        },
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[procurement/fifo-gaps]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
