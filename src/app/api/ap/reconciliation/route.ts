import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildReconciliationReport } from '@/lib/sat/reconciliation'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

// GET /api/ap/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD&emisor_rfc=…
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

    if (!from || !to) {
      return NextResponse.json({ error: 'Se requieren parámetros from y to (YYYY-MM-DD)' }, { status: 400 })
    }

    const emisorRfc = searchParams.get('emisor_rfc') || undefined
    const report = await buildReconciliationReport(supabase as any, from, to, emisorRfc)
    return NextResponse.json(report)
  } catch (err) {
    console.error('GET /api/ap/reconciliation error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
