import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  assertOrderAccess,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'
import { createAdminClient } from '@/lib/supabase/admin'

const PAGE = 30

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireFinanzasAuditContext(request)
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const entityType = searchParams.get('entity')
    const cursor = searchParams.get('cursor')

    if (!orderId?.trim()) {
      return NextResponse.json({ error: 'order_id requerido' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, plant_id, quote_id')
      .eq('id', orderId.trim())
      .maybeSingle()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    try {
      await assertOrderAccess(ctx.profile, order.plant_id as string | null)
    } catch (e) {
      if (e instanceof Error && e.message === 'FORBIDDEN_ORDER') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
      throw e
    }

    const admin = createAdminClient()
    const oid = orderId.trim()
    const quoteId = order.quote_id as string | null | undefined

    let q = admin.from('finanzas_audit_log').select('*')

    if (entityType?.trim()) {
      q = q.eq('entity_type', entityType.trim())
    }

    if (quoteId) {
      q = q.or(
        `order_id.eq.${oid},and(quote_id.eq.${quoteId},entity_type.eq.quote_detail)`
      )
    } else {
      q = q.eq('order_id', oid)
    }

    q = q.order('occurred_at', { ascending: false }).limit(PAGE + 1)

    if (cursor?.trim()) {
      q = q.lt('occurred_at', cursor.trim())
    }

    const { data: rows, error: logErr } = await q

    if (logErr) {
      console.error('audit log', logErr)
      return NextResponse.json({ error: 'Error al cargar historial' }, { status: 500 })
    }

    const list = rows || []
    const hasMore = list.length > PAGE
    const pageRows = hasMore ? list.slice(0, PAGE) : list
    const nextCursor =
      hasMore && pageRows.length > 0
        ? pageRows[pageRows.length - 1]?.occurred_at
        : null

    return NextResponse.json({
      success: true,
      data: {
        rows: pageRows,
        next_cursor: nextCursor,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_PROFILE' || msg === 'FORBIDDEN_FINANZAS') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('GET audit log', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
