import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { applyRepPayments } from '@/lib/sat/repPayments'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = await request.json()
    const items = body?.items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'items es requerido' }, { status: 400 })
    }

    const normalized = items.map(
      (i: {
        rep_uuid: string
        docto_uuid: string
        num_parcialidad: number
        supplier_invoice_id?: string
      }) => ({
        rep_uuid: String(i.rep_uuid).toLowerCase(),
        docto_uuid: String(i.docto_uuid).toLowerCase(),
        num_parcialidad: Number(i.num_parcialidad) || 1,
        supplier_invoice_id: i.supplier_invoice_id ? String(i.supplier_invoice_id) : undefined,
      }),
    )

    const plantIdScope =
      profile.role === 'PLANT_MANAGER' && profile.plant_id ? profile.plant_id : null

    const result = await applyRepPayments(supabase, user.id, normalized, { plantIdScope })
    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/ap/sat-pagos-apply error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
