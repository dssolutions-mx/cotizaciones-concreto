import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  assertOrderAccess,
  getRequestAuditMeta,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'
import {
  assertWritableOrderStatus,
} from '@/lib/finanzas/auditCapabilities'
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog'
import { recalculateOrderAmount } from '@/services/orderService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const ctx = await requireFinanzasAuditContext(request, { requireWriter: true })
    const admin = createAdminClient()

    let body: { reason?: string; allow_post_close?: boolean }
    try {
      body = await request.json()
    } catch {
      body = {}
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim().length >= 10
        ? body.reason.trim()
        : null
    if (!reason) {
      return NextResponse.json({ error: 'Motivo debe tener al menos 10 caracteres' }, { status: 400 })
    }

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, plant_id, order_status, client_id, preliminary_amount, final_amount, invoice_amount'
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
      preliminary_amount: order.preliminary_amount as number | null,
    }

    await recalculateOrderAmount(orderId, admin)

    const { data: orderAfter } = await admin
      .from('orders')
      .select('final_amount, invoice_amount')
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
        client_id: order.client_id as string,
        action: 'recalculate',
        reason,
        changes: [{ field: 'order.recalculate', old: amountsBefore, new: orderAfter }],
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
    console.error('POST recalculate', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
