import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const READ_ROLES = new Set([
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
  'ADMINISTRATIVE',
  'PLANT_MANAGER',
  'SALES_AGENT',
])

const MAX_ORDERS = 60

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !READ_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('order_ids') || ''
    const orderIds = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))].slice(
      0,
      MAX_ORDERS
    )
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'order_ids requerido' }, { status: 400 })
    }

    const { data: orders, error: oErr } = await supabase
      .from('orders')
      .select('id, plant_id')
      .in('id', orderIds)

    if (oErr) {
      return NextResponse.json({ error: 'Error al validar pedidos' }, { status: 500 })
    }

    const allowedOrderIds = (orders || [])
      .filter((o) => {
        if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
          return o.plant_id === profile.plant_id
        }
        return true
      })
      .map((o) => o.id)

    const allowedOrderSet = new Set(allowedOrderIds)

    if (allowedOrderIds.length === 0) {
      return NextResponse.json({ success: true, data: { remision_ids: [], plant_ids: [] } })
    }

    const { data: rems, error: rErr } = await supabase
      .from('remisiones')
      .select('id')
      .in('order_id', allowedOrderIds)
      .eq('tipo_remision', 'CONCRETO')

    if (rErr) {
      return NextResponse.json({ error: 'Error al cargar remisiones' }, { status: 500 })
    }

    const remision_ids = (rems || []).map((r) => (r as { id: string }).id)
    const plant_ids = [
      ...new Set(
        (orders || [])
          .filter((o) => allowedOrderSet.has(o.id))
          .map((o) => (o as { plant_id?: string | null }).plant_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]

    return NextResponse.json({ success: true, data: { remision_ids, plant_ids } })
  } catch (e) {
    console.error('concrete-remision-ids GET:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
