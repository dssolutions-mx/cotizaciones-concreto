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
import { insertFinanzasAuditLog, toUuidOrNull } from '@/lib/finanzas/auditLog'
import { recalculateOrderAmount } from '@/services/orderService'
import { estimateOrderFinancials } from '@/lib/finanzas/estimateOrderFinancials'
import {
  mergeOrderItemOpsForPreview,
  sanitizePatch,
  type FinanzasItemOp,
} from '@/lib/finanzas/mergeOrderItemOps'
import { augmentFinanzasItemOpsWithPriceLinkage } from '@/lib/finanzas/augmentOrderItemUpdatesForPriceLinkage'
import { buildOrderItemLineDiffs } from '@/lib/finanzas/buildOrderItemLineDiffs'

type Body = {
  ops: FinanzasItemOp[]
  reason?: string
  allow_post_close?: boolean
}

function validateReason(reason: unknown): string {
  const r = typeof reason === 'string' ? reason.trim() : ''
  if (r.length < 10) throw new Error('REASON_SHORT')
  return r
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
      body = (await request.json()) as Body
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const ops = Array.isArray(body.ops) ? body.ops : []
    if (ops.length === 0) {
      return NextResponse.json({ error: 'ops requerido' }, { status: 400 })
    }

    const reason = preview ? (typeof body.reason === 'string' ? body.reason : 'preview') : validateReason(body.reason)

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select(
        'id, plant_id, order_status, client_id, quote_id, construction_site, requires_invoice, preliminary_amount, final_amount, invoice_amount, effective_for_balance'
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
        return NextResponse.json({ error: 'No autorizado para este pedido' }, { status: 403 })
      }
      throw e
    }

    const crossPlant =
      ctx.profile.plant_id != null && ctx.profile.plant_id !== order.plant_id

    if (!preview) {
      try {
        assertWritableOrderStatus(
          order.order_status as string,
          ctx.profile,
          Boolean(body.allow_post_close)
        )
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : 'Estado no editable' },
          { status: 400 }
        )
      }
    }

    const { data: remisionesRows } = await admin
      .from('remisiones')
      .select('tipo_remision, volumen_fabricado')
      .eq('order_id', orderId)
    const hasAnyRemisiones = (remisionesRows?.length ?? 0) > 0
    const remisionesConcreteVolumeSum =
      (remisionesRows || [])
        .filter((r) => r.tipo_remision === 'CONCRETO')
        .reduce((s, r) => s + (Number(r.volumen_fabricado) || 0), 0) || 0

    const { data: plantRow } = await admin
      .from('plants')
      .select(`business_unit:business_unit_id(vat_rate)`)
      .eq('id', order.plant_id as string)
      .maybeSingle()

    const buRaw = plantRow?.business_unit as { vat_rate?: number } | { vat_rate?: number }[] | null
    const vatRate =
      Array.isArray(buRaw) ? buRaw[0]?.vat_rate ?? 0.16 : buRaw?.vat_rate ?? 0.16

    const { data: itemsBefore } = await admin.from('order_items').select('*').eq('order_id', orderId)

    const { ops: augmentedOps, manualPriceOrphan } = await augmentFinanzasItemOpsWithPriceLinkage(
      admin,
      orderId,
      {
        client_id: order.client_id as string,
        construction_site: order.construction_site as string,
        plant_id: order.plant_id as string,
      },
      (itemsBefore || []) as Array<Record<string, unknown>>,
      ops
    )

    const productPriceIds = augmentedOps
      .filter((o): o is Extract<FinanzasItemOp, { type: 'apply_product_price' }> => o.type === 'apply_product_price')
      .map((o) => o.product_price_id)

    const productPriceById = new Map<string, { base_price: number; is_active: boolean }>()
    if (productPriceIds.length > 0) {
      const { data: pps } = await admin
        .from('product_prices')
        .select('id, base_price, is_active, client_id, construction_site')
        .in('id', [...new Set(productPriceIds)])
      for (const p of pps || []) {
        productPriceById.set(p.id as string, {
          base_price: Number(p.base_price) || 0,
          is_active: Boolean(p.is_active),
        })
      }
    }

    let usedInactive = false
    for (const op of augmentedOps) {
      if (op.type === 'apply_product_price') {
        const row = productPriceById.get(op.product_price_id)
        if (!row) {
          return NextResponse.json({ error: 'Precio de producto no encontrado' }, { status: 400 })
        }
        if (!row.is_active) usedInactive = true
      }
    }

    const mergedForEstimate = mergeOrderItemOpsForPreview(
      (itemsBefore || []) as unknown as Parameters<typeof mergeOrderItemOpsForPreview>[0],
      augmentedOps,
      new Map([...productPriceById].map(([k, v]) => [k, { base_price: v.base_price }]))
    )

    const estAfter = estimateOrderFinancials({
      requiresInvoice: Boolean(order.requires_invoice),
      vatRate: Number(vatRate) || 0.16,
      items: mergedForEstimate,
      hasAnyRemisiones,
      effectiveForBalance: Boolean(order.effective_for_balance),
      remisionesConcreteVolumeSum,
    })

    const estBefore = estimateOrderFinancials({
      requiresInvoice: Boolean(order.requires_invoice),
      vatRate: Number(vatRate) || 0.16,
      items: (itemsBefore || []) as unknown as Parameters<typeof estimateOrderFinancials>[0]['items'],
      hasAnyRemisiones,
      effectiveForBalance: Boolean(order.effective_for_balance),
      remisionesConcreteVolumeSum,
    })

    if (preview) {
      const line_diffs = buildOrderItemLineDiffs(
        (itemsBefore || []) as Array<Record<string, unknown> & { id?: string }>,
        mergedForEstimate as Array<Record<string, unknown> & { id?: string }>
      )
      return NextResponse.json({
        success: true,
        preview: true,
        data: {
          estimates: { before: estBefore, after: estAfter },
          line_diffs,
          order_snapshot: {
            final_amount: order.final_amount,
            invoice_amount: order.invoice_amount,
            preliminary_amount: order.preliminary_amount,
          },
          flags: {
            used_inactive: usedInactive,
            cross_plant: crossPlant,
            manual_price_orphan: manualPriceOrphan,
          },
        },
      })
    }

    const amountsBefore = {
      final_amount: order.final_amount as number | null,
      invoice_amount: order.invoice_amount as number | null,
      preliminary_amount: order.preliminary_amount as number | null,
    }

    const changes: Array<{ field: string; old: unknown; new: unknown }> = []

    for (const op of augmentedOps) {
      if (op.type === 'update') {
        const patch = sanitizePatch(op.patch)
        const { data: prev } = await admin
          .from('order_items')
          .select('*')
          .eq('id', op.id)
          .eq('order_id', orderId)
          .maybeSingle()
        if (!prev) {
          return NextResponse.json({ error: `Ítem no encontrado: ${op.id}` }, { status: 400 })
        }
        const { error: upErr } = await admin.from('order_items').update(patch).eq('id', op.id)
        if (upErr) {
          console.error('audit items update', upErr)
          return NextResponse.json({ error: upErr.message }, { status: 400 })
        }
        for (const [k, v] of Object.entries(patch)) {
          changes.push({ field: `order_item.${op.id}.${k}`, old: (prev as Record<string, unknown>)[k], new: v })
        }
      } else if (op.type === 'delete') {
        const { data: prev } = await admin
          .from('order_items')
          .select('*')
          .eq('id', op.id)
          .eq('order_id', orderId)
          .maybeSingle()
        if (!prev) {
          return NextResponse.json({ error: `Ítem no encontrado: ${op.id}` }, { status: 400 })
        }
        const { error: delErr } = await admin.from('order_items').delete().eq('id', op.id)
        if (delErr) {
          console.error('audit items delete', delErr)
          return NextResponse.json({ error: delErr.message }, { status: 400 })
        }
        changes.push({ field: `order_item.${op.id}`, old: prev, new: null })
      } else if (op.type === 'insert') {
        const row = {
          ...op.item,
          order_id: orderId,
        }
        const { data: ins, error: insErr } = await admin
          .from('order_items')
          .insert(row as Record<string, unknown>)
          .select('id')
          .single()
        if (insErr) {
          console.error('audit items insert', insErr)
          return NextResponse.json({ error: insErr.message }, { status: 400 })
        }
        changes.push({ field: 'order_item.insert', old: null, new: { id: ins?.id, ...row } })
      } else if (op.type === 'apply_product_price') {
        const pp = productPriceById.get(op.product_price_id)!
        const { data: prev } = await admin
          .from('order_items')
          .select('*')
          .eq('id', op.order_item_id)
          .eq('order_id', orderId)
          .maybeSingle()
        if (!prev) {
          return NextResponse.json({ error: 'Línea de pedido no encontrada' }, { status: 400 })
        }
        const vol = Number(prev.volume) || 0
        const unit = pp.base_price
        const patch =
          prev.product_type === 'SERVICIO DE BOMBEO'
            ? { unit_price: unit, pump_price: unit, total_price: unit * vol }
            : { unit_price: unit, total_price: unit * vol }
        const { error: upErr } = await admin
          .from('order_items')
          .update(patch)
          .eq('id', op.order_item_id)
        if (upErr) {
          return NextResponse.json({ error: upErr.message }, { status: 400 })
        }
        for (const [k, v] of Object.entries(patch)) {
          changes.push({
            field: `order_item.${op.order_item_id}.${k}`,
            old: (prev as Record<string, unknown>)[k],
            new: v,
          })
        }
        changes.push({
          field: `order_item.${op.order_item_id}.product_price_id`,
          old: null,
          new: op.product_price_id,
        })
      }
    }

    await recalculateOrderAmount(orderId, admin)

    const { data: orderAfter } = await admin
      .from('orders')
      .select('final_amount, invoice_amount, preliminary_amount')
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
        quote_id: toUuidOrNull(order.quote_id),
        client_id: toUuidOrNull(order.client_id),
        action: 'update',
        reason,
        changes,
        financial_delta: {
          final_amount_before: amountsBefore.final_amount,
          final_amount_after: orderAfter?.final_amount ?? null,
          invoice_amount_before: amountsBefore.invoice_amount,
          invoice_amount_after: orderAfter?.invoice_amount ?? null,
          preliminary_amount: amountsBefore.preliminary_amount,
        },
        flags: {
          used_inactive: usedInactive,
          cross_plant: crossPlant,
          post_close: ['completed', 'cancelled'].includes(order.order_status as string),
          manual_price_orphan: manualPriceOrphan,
        },
        request_ip: meta.request_ip,
        user_agent: meta.user_agent,
      },
      admin
    )

    return NextResponse.json({
      success: true,
      data: {
        financial_delta: {
          final_amount_before: amountsBefore.final_amount,
          final_amount_after: orderAfter?.final_amount ?? null,
          invoice_amount_before: amountsBefore.invoice_amount,
          invoice_amount_after: orderAfter?.invoice_amount ?? null,
        },
        estimates: { before: estBefore, after: estAfter },
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_WRITER' || msg === 'FORBIDDEN_FINANZAS' || msg === 'FORBIDDEN_PROFILE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (msg === 'REASON_SHORT') {
      return NextResponse.json({ error: 'Motivo debe tener al menos 10 caracteres' }, { status: 400 })
    }
    console.error('POST audit items', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
