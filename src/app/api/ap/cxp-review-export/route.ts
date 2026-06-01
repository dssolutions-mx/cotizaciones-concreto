import { NextRequest, NextResponse } from 'next/server'
import { format } from 'date-fns'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { loadCxpReviewExportData } from '@/lib/ap/cxpReviewExportData'
import { buildCxpReviewExcel } from '@/lib/reports/cxpReviewExcel'

const ALLOWED_ROLES = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER']

export const maxDuration = 120

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const plant_id = request.nextUrl.searchParams.get('plant_id') || undefined
    const generatedAt = new Date()

    const data = await loadCxpReviewExportData(supabase, {
      plantId: plant_id,
    })
    const buffer = await buildCxpReviewExcel(data, { generatedAt })

    const scopeSlug = data.plantScopeLabel
      .replace(/[^\w\-]+/g, '_')
      .slice(0, 30)
    const fileName = `CuentasPorPagar_Revision_Integral_${scopeSlug}_${format(generatedAt, 'yyyy-MM-dd')}.xlsx`

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('GET /api/ap/cxp-review-export error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
