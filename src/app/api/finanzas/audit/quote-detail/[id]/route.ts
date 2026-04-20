import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestAuditMeta, requireFinanzasAuditContext } from '@/lib/finanzas/auditRequestContext'
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog'
import { productPriceService } from '@/lib/supabase/product-prices'

type Body = {
  final_price?: number
  base_price?: number
  profit_margin?: number
  pump_price?: number
  reason?: string
  preview?: boolean
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: detailId } = await params
    const ctx = await requireFinanzasAuditContext(request, { requireWriter: true })
    const admin = createAdminClient()

    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const preview = Boolean(body.preview) || request.nextUrl.searchParams.get('preview') === '1'

    const { data: detail, error: dErr } = await admin
      .from('quote_details')
      .select('id, quote_id, final_price, base_price, profit_margin, pump_price')
      .eq('id', detailId)
      .maybeSingle()

    if (dErr || !detail) {
      return NextResponse.json({ error: 'Línea de cotización no encontrada' }, { status: 404 })
    }

    const quoteId = detail.quote_id as string

    const { data: quote, error: qErr } = await admin
      .from('quotes')
      .select('id, plant_id, client_id, construction_site')
      .eq('id', quoteId)
      .maybeSingle()

    if (qErr || !quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    const patch: Record<string, number> = {}
    if (typeof body.final_price === 'number') patch.final_price = body.final_price
    if (typeof body.base_price === 'number') patch.base_price = body.base_price
    if (typeof body.profit_margin === 'number') patch.profit_margin = body.profit_margin
    if (typeof body.pump_price === 'number') patch.pump_price = body.pump_price

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const changes = Object.entries(patch).map(([field, newVal]) => ({
      field: `quote_detail.${detailId}.${field}`,
      old: (detail as Record<string, unknown>)[field],
      new: newVal,
    }))

    const { data: impactedOrders } = await admin
      .from('orders')
      .select('id, order_number, final_amount')
      .eq('quote_id', quoteId)
      .limit(200)

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        data: {
          quote_detail_id: detailId,
          quote_id: quoteId,
          patch,
          impacted_orders: impactedOrders || [],
        },
      })
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim().length >= 10
        ? body.reason.trim()
        : null
    if (!reason) {
      return NextResponse.json({ error: 'Motivo debe tener al menos 10 caracteres' }, { status: 400 })
    }

    const { error: upErr } = await admin.from('quote_details').update(patch).eq('id', detailId)
    if (upErr) {
      console.error('quote_detail update', upErr)
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    try {
      await productPriceService.handleQuoteApproval(quoteId, admin)
    } catch (e) {
      console.warn('handleQuoteApproval after detail edit', e)
    }

    const meta = getRequestAuditMeta(request)
    await insertFinanzasAuditLog(
      {
        actor_id: ctx.profile.id,
        actor_role: ctx.profile.role,
        actor_plant_id: ctx.profile.plant_id,
        entity_type: 'quote_detail',
        entity_id: detailId,
        quote_id: quoteId,
        client_id: quote.client_id as string,
        action: 'update',
        reason,
        changes,
        flags: {},
        request_ip: meta.request_ip,
        user_agent: meta.user_agent,
      },
      admin
    )

    return NextResponse.json({
      success: true,
      data: {
        impacted_order_ids: (impactedOrders || []).map((o) => o.id),
        message:
          'Línea actualizada. Recalcule los pedidos afectados desde el panel si los montos deben reflejar el cambio.',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_WRITER' || msg === 'FORBIDDEN_FINANZAS') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('PATCH quote-detail', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
