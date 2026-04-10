import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const PatchSupplierSchema = z.object({
  default_payment_terms_days: z
    .union([z.number().int().min(0).max(365), z.null()])
    .optional(),
  /** When sent, update only applies if the supplier belongs to this plant (matches GET ?plant_id=). */
  plant_id: z.string().uuid().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params
    if (!supplierId) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
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

    const allowedRoles = ['EXECUTIVE', 'ADMIN_OPERATIONS']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const json = await request.json()
    const parsed = PatchSupplierSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.default_payment_terms_days !== undefined) {
      updates.default_payment_terms_days = parsed.data.default_payment_terms_days
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    // RLS often allows SELECT on suppliers but not UPDATE for the same session; use service role
    // after application-level role checks (same pattern as other admin API routes).
    let admin
    try {
      admin = createServiceClient()
    } catch {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta (service role)' },
        { status: 503 }
      )
    }

    // Read first: do not chain plant_id on UPDATE — legacy rows may have null plant_id or
    // edge cases from entry pricing vs list; filtering UPDATE caused PGRST116 (0 rows).
    const { data: existing, error: existingErr } = await admin
      .from('suppliers')
      .select('id, plant_id')
      .eq('id', supplierId)
      .maybeSingle()

    if (existingErr) {
      console.error('PATCH suppliers/[id] fetch:', existingErr)
      return NextResponse.json({ error: 'No se pudo leer el proveedor' }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Proveedor no encontrado' }, { status: 404 })
    }

    if (parsed.data.plant_id) {
      const expected = parsed.data.plant_id
      if (existing.plant_id != null && existing.plant_id !== expected) {
        return NextResponse.json(
          {
            error:
              'Este proveedor no corresponde a la planta de la entrada. Elija otro proveedor o abra la gestión desde la planta correcta.',
          },
          { status: 403 }
        )
      }
    }

    const { data: supplier, error } = await admin
      .from('suppliers')
      .update(updates)
      .eq('id', supplierId)
      .select()
      .single()

    if (error) {
      console.error('PATCH suppliers/[id]:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'No se pudo actualizar el proveedor (sin filas afectadas)' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: 'No se pudo actualizar el proveedor' }, { status: 500 })
    }

    return NextResponse.json({ supplier })
  } catch (e) {
    console.error('PATCH suppliers/[id]:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
