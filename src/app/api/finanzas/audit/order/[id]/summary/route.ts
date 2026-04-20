import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  assertOrderAccess,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'
import { canWriteFinanzasAudit } from '@/lib/finanzas/auditCapabilities'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const ctx = await requireFinanzasAuditContext(request)
    const supabase = await createServerSupabaseClient()

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        order_status,
        delivery_date,
        client_id,
        construction_site,
        construction_site_id,
        plant_id,
        quote_id,
        requires_invoice,
        preliminary_amount,
        final_amount,
        invoice_amount,
        effective_for_balance,
        created_at,
        plant:plant_id(
          id,
          name,
          code,
          business_unit:business_unit_id(
            id,
            name,
            code,
            vat_rate
          )
        )
      `
      )
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }

    try {
      await assertOrderAccess(ctx.profile, order.plant_id as string | null)
    } catch (e) {
      const code = e instanceof Error ? e.message : ''
      if (code === 'FORBIDDEN_ORDER') {
        return NextResponse.json({ error: 'No autorizado para este pedido' }, { status: 403 })
      }
      throw e
    }

    const { data: orderItems, error: itemsErr } = await supabase
      .from('order_items')
      .select(
        `
        *,
        quote_details:quote_detail_id (
          id,
          recipe_id,
          master_recipe_id,
          final_price,
          base_price,
          pump_service,
          pump_price,
          recipes ( recipe_code ),
          master_recipes ( master_code )
        )
      `
      )
      .eq('order_id', orderId)

    if (itemsErr) {
      console.error('audit summary order_items', itemsErr)
      return NextResponse.json({ error: 'Error al cargar productos del pedido' }, { status: 500 })
    }

    const { data: remisiones, error: remErr } = await supabase
      .from('remisiones')
      .select(
        'id, remision_number, fecha, hora_carga, volumen_fabricado, unidad, conductor, tipo_remision'
      )
      .eq('order_id', orderId)

    if (remErr) {
      console.error('audit summary remisiones', remErr)
      return NextResponse.json({ error: 'Error al cargar remisiones' }, { status: 500 })
    }

    const concreteRemisiones = (remisiones || []).filter((r) => r.tipo_remision === 'CONCRETO')
    const pumpingRemisiones = (remisiones || []).filter((r) => r.tipo_remision === 'BOMBEO')
    const concreteVolSum = concreteRemisiones.reduce(
      (s, r) => s + (Number(r.volumen_fabricado) || 0),
      0
    )
    const pumpingVolSum = pumpingRemisiones.reduce(
      (s, r) => s + (Number(r.volumen_fabricado) || 0),
      0
    )

    let quote: unknown = null
    if (order.quote_id) {
      const { data: q, error: qErr } = await supabase
        .from('quotes')
        .select(
          `
          id,
          quote_number,
          status,
          created_at,
          client_id,
          construction_site,
          plant_id,
          quote_details (
            id,
            recipe_id,
            master_recipe_id,
            final_price,
            base_price,
            profit_margin,
            pump_service,
            pump_price,
            volume,
            recipes ( recipe_code ),
            master_recipes ( master_code )
          )
        `
        )
        .eq('id', order.quote_id)
        .maybeSingle()
      if (!qErr) quote = q
    }

    const writer = canWriteFinanzasAudit(ctx.profile)
    let productPricesQuery = supabase
      .from('product_prices')
      .select(
        `
        id,
        code,
        description,
        base_price,
        is_active,
        effective_date,
        updated_at,
        master_recipe_id,
        recipe_id,
        client_id,
        construction_site,
        plant_id,
        quote_id
      `
      )
      .eq('client_id', order.client_id as string)
      .eq('construction_site', order.construction_site as string)
      .order('is_active', { ascending: false })
      .order('effective_date', { ascending: false })

    if (!writer) {
      productPricesQuery = productPricesQuery.eq('is_active', true)
    }

    const { data: productPrices, error: ppErr } = await productPricesQuery

    if (ppErr) {
      console.error('audit summary product_prices', ppErr)
      return NextResponse.json({ error: 'Error al cargar precios del cliente' }, { status: 500 })
    }

    const pumpLine = (orderItems || []).find((i) => i.product_type === 'SERVICIO DE BOMBEO')
    const pricedPumpVol = Number(pumpLine?.pump_volume) || 0

    return NextResponse.json({
      success: true,
      data: {
        order,
        order_items: orderItems || [],
        pumping_remisiones: pumpingRemisiones,
        concrete_remisiones_count: concreteRemisiones.length,
        pumping_remisiones_count: pumpingRemisiones.length,
        concrete_volume_delivered_sum: concreteVolSum,
        pumping_volume_sum: pumpingVolSum,
        pump_priced_volume: pricedPumpVol,
        quote,
        product_prices: productPrices || [],
        capabilities: {
          canWrite: writer,
          canPostClose:
            ctx.profile.role === 'EXECUTIVE' || ctx.profile.role === 'ADMIN_OPERATIONS',
        },
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
    console.error('GET audit summary', e)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
