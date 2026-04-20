import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertOrderAccess,
  getRequestAuditMeta,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'
import { assertWritableOrderStatus } from '@/lib/finanzas/auditCapabilities'
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog'
import { applyQuoteToOrder } from '@/lib/finanzas/applyQuoteToOrder'

type Body = {
  target_quote_id: string
  reason?: string
  allow_post_close?: boolean
  confirm?: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const preview = request.nextUrl.searchParams.get('preview') === '1'
    const ctx = await requireFinanzasAuditContext(request, { requireWriter: true })
    const admin = createAdminClient()

    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const targetQuoteId = typeof body.target_quote_id === 'string' ? body.target_quote_id.trim() : ''
    if (!targetQuoteId) {
      return NextResponse.json({ error: 'target_quote_id requerido' }, { status: 400 })
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, plant_id, order_status, client_id, construction_site, quote_id, final_amount, invoice_amount, preliminary_amount'
      )
      .eq('id', orderId)
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

    const { data: quote, error: qErr } = await admin
      .from('quotes')
      .select('id, client_id, construction_site, plant_id, status')
      .eq('id', targetQuoteId)
      .maybeSingle()

    if (qErr || !quote) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 })
    }

    if (quote.client_id !== order.client_id) {
      return NextResponse.json({ error: 'La cotización no pertenece al mismo cliente' }, { status: 400 })
    }
    if (quote.construction_site !== order.construction_site) {
      return NextResponse.json({ error: 'La cotización no coincide con la obra del pedido' }, { status: 400 })
    }

    if (preview || !body.confirm) {
      const { data: items } = await admin
        .from('order_items')
        .select('id, master_recipe_id, product_type, volume, unit_price, quote_detail_id, total_price')
        .eq('order_id', orderId)

      const { data: qFull } = await admin
        .from('quotes')
        .select(
          `
          id,
          quote_details ( id, master_recipe_id, final_price, pump_service )
        `
        )
        .eq('id', targetQuoteId)
        .single()

      const details =
        (qFull as { quote_details?: Array<Record<string, unknown>> } | null)?.quote_details || []
      const priceByMaster = new Map<string, { quote_detail_id: string; unitPrice: number }>()
      for (const d of details) {
        const mid = d.master_recipe_id as string | null
        if (!mid || d.pump_service) continue
        priceByMaster.set(mid, {
          quote_detail_id: d.id as string,
          unitPrice: Number(d.final_price) || 0,
        })
      }

      const lineDiffs: Array<Record<string, unknown>> = []
      for (const item of items || []) {
        const pt = item.product_type as string
        if (
          pt === 'VACÍO DE OLLA' ||
          pt === 'SERVICIO DE BOMBEO' ||
          pt?.startsWith('PRODUCTO ADICIONAL:')
        ) {
          continue
        }
        const mid = item.master_recipe_id as string | null
        if (!mid) continue
        const link = priceByMaster.get(mid)
        if (!link) continue
        const vol = Number(item.volume) || 0
        const newUnit = link.unitPrice
        const newTotal = newUnit * vol
        if (Number(item.unit_price) !== newUnit) {
          lineDiffs.push({
            order_item_id: item.id,
            old_unit_price: item.unit_price,
            new_unit_price: newUnit,
            old_total_price: item.total_price,
            new_total_price: newTotal,
          })
        }
      }

      return NextResponse.json({
        success: true,
        preview: true,
        data: {
          target_quote_id: targetQuoteId,
          current_quote_id: order.quote_id,
          line_diffs: lineDiffs,
          quote_status: quote.status,
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

    try {
      assertWritableOrderStatus(
        order.order_status as string,
        ctx.profile,
        Boolean(body.allow_post_close)
      )
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'No editable' },
        { status: 400 }
      )
    }

    const amountsBefore = {
      final_amount: order.final_amount as number | null,
      invoice_amount: order.invoice_amount as number | null,
    }

    const { changes } = await applyQuoteToOrder(admin, orderId, targetQuoteId)

    const { data: orderAfter } = await admin
      .from('orders')
      .select('final_amount, invoice_amount, quote_id')
      .eq('id', orderId)
      .single()

    const meta = getRequestAuditMeta(request)
    await insertFinanzasAuditLog(
      {
        actor_id: ctx.profile.id,
        actor_role: ctx.profile.role,
        actor_plant_id: ctx.profile.plant_id,
        entity_type: 'order',
        entity_id: orderId,
        order_id: orderId,
        quote_id: targetQuoteId,
        client_id: order.client_id as string,
        action: 'requote',
        reason,
        changes: [...changes, { field: 'meta', old: null, new: { target_quote_id: targetQuoteId } }],
        financial_delta: {
          final_amount_before: amountsBefore.final_amount,
          final_amount_after: orderAfter?.final_amount ?? null,
          invoice_amount_before: amountsBefore.invoice_amount,
          invoice_amount_after: orderAfter?.invoice_amount ?? null,
        },
        flags: {
          post_close: ['completed', 'cancelled'].includes(order.order_status as string),
        },
        request_ip: meta.request_ip,
        user_agent: meta.user_agent,
      },
      admin
    )

    return NextResponse.json({
      success: true,
      data: {
        quote_id: orderAfter?.quote_id,
        final_amount: orderAfter?.final_amount,
        invoice_amount: orderAfter?.invoice_amount,
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
    console.error('POST requote', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
