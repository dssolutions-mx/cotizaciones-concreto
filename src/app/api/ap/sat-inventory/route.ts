import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// GET /api/ap/sat-inventory?from=YYYY-MM-DD&to=YYYY-MM-DD&emisor_rfc=…
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to   = searchParams.get('to')
    const emisorRfc = searchParams.get('emisor_rfc')

    let query = supabase
      .from('sat_cfdi_recibidos')
      .select('uuid, emisor_rfc, emisor_nombre, serie, folio, fecha_emision, tipo_comprobante, subtotal, descuento, total, iva_trasladado, estado_sat, moneda, imported_at, source')
      .order('fecha_emision', { ascending: false })
      .limit(500)

    if (from) query = query.gte('fecha_emision', from)
    if (to)   query = query.lte('fecha_emision', to + 'T23:59:59')
    if (emisorRfc) query = query.eq('emisor_rfc', emisorRfc)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rows: data ?? [] })
  } catch (err) {
    console.error('GET /api/ap/sat-inventory error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
