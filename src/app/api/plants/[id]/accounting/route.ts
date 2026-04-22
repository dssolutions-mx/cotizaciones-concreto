import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import {
  canAccessAllInventoryPlants,
  hasInventoryStandardAccess,
} from '@/lib/auth/inventoryRoles'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const PLANT_ACCOUNTING_SELECT = 'id, code, name, accounting_concept, warehouse_number'

type ProfileRow = { role?: string | null; plant_id?: string | null; business_unit_id?: string | null }

/** Misma regla de alcance que PATCH (antes de mutar o leer con service role). */
async function assertPlantAccountingAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  profile: ProfileRow,
  plantId: string
): Promise<NextResponse | null> {
  if (!hasInventoryStandardAccess(profile.role)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  if (!canAccessAllInventoryPlants(profile.role)) {
    if (profile.plant_id && profile.plant_id !== plantId) {
      return NextResponse.json({ error: 'Solo puede ver o editar su planta asignada' }, { status: 403 })
    }
    if (profile.business_unit_id && !profile.plant_id) {
      const { data: row } = await supabase
        .from('plants')
        .select('id')
        .eq('id', plantId)
        .eq('business_unit_id', profile.business_unit_id)
        .maybeSingle()
      if (!row) {
        return NextResponse.json({ error: 'Planta fuera de su unidad de negocio' }, { status: 403 })
      }
    }
  }

  return null
}

/**
 * GET /api/plants/[id]/accounting
 * Lee concepto contable y almacén. Usa service role tras validar perfil porque en algunos despliegues
 * RLS en `plants` no devuelve columnas contables al cliente aunque el usuario sí pueda exportar entradas.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: plantId } = await params

    if (!UUID_RE.test(plantId)) {
      return NextResponse.json({ error: 'ID de planta inválido' }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const denied = await assertPlantAccountingAccess(supabase, profile, plantId)
    if (denied) return denied

    try {
      const admin = createServiceClient()
      const { data: plant, error } = await admin
        .from('plants')
        .select(PLANT_ACCOUNTING_SELECT)
        .eq('id', plantId)
        .maybeSingle()

      if (error) {
        console.error('GET plant accounting (service):', error)
        return NextResponse.json({ error: 'No se pudo leer la planta' }, { status: 500 })
      }
      if (!plant) {
        return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 })
      }

      return NextResponse.json({ success: true, plant })
    } catch (e) {
      console.warn('GET plant accounting: service client unavailable, falling back to user JWT', e)
      const { data: plant, error } = await supabase
        .from('plants')
        .select(PLANT_ACCOUNTING_SELECT)
        .eq('id', plantId)
        .maybeSingle()

      if (error) {
        console.error('GET plant accounting (user):', error)
        return NextResponse.json({ error: 'No se pudo leer la planta' }, { status: 500 })
      }
      if (!plant) {
        return NextResponse.json({ error: 'Planta no encontrada' }, { status: 404 })
      }

      return NextResponse.json({ success: true, plant })
    }
  } catch (e) {
    console.error('GET /api/plants/[id]/accounting', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/plants/[id]/accounting
 * Actualiza solo concepto contable y número de almacén (por planta).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { id: plantId } = await params

    if (!UUID_RE.test(plantId)) {
      return NextResponse.json({ error: 'ID de planta inválido' }, { status: 400 })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    const denied = await assertPlantAccountingAccess(supabase, profile, plantId)
    if (denied) return denied

    const body = await request.json().catch(() => ({}))
    const conceptRaw = body.accounting_concept
    const warehouseRaw = body.warehouse_number

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('accounting_concept' in body) {
      if (conceptRaw != null && typeof conceptRaw !== 'string') {
        return NextResponse.json({ error: 'accounting_concept debe ser texto' }, { status: 400 })
      }
      update.accounting_concept =
        conceptRaw == null || String(conceptRaw).trim() === '' ? null : String(conceptRaw).trim()
    }

    if ('warehouse_number' in body) {
      if (warehouseRaw == null || warehouseRaw === '') {
        update.warehouse_number = null
      } else {
        const n = Number(warehouseRaw)
        if (!Number.isInteger(n)) {
          return NextResponse.json({ error: 'warehouse_number debe ser entero' }, { status: 400 })
        }
        update.warehouse_number = n
      }
    }

    if (Object.keys(update).length <= 1) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const { data: plant, error } = await supabase
      .from('plants')
      .update(update)
      .eq('id', plantId)
      .select(`${PLANT_ACCOUNTING_SELECT}, business_unit_id, is_active, created_at, updated_at`)
      .single()

    if (error) {
      console.error('PATCH plant accounting:', error)
      return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, plant })
  } catch (e) {
    console.error('PATCH /api/plants/[id]/accounting', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
