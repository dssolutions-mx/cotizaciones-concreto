import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  assertOrderAccess,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const orderItemId = request.nextUrl.searchParams.get('order_item_id')
    if (!orderItemId) {
      return NextResponse.json({ error: 'order_item_id requerido' }, { status: 400 })
    }

    const ctx = await requireFinanzasAuditContext(request)
    const supabase = await createServerSupabaseClient()

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, plant_id, client_id, construction_site')
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

    const { data: item, error: itemErr } = await supabase
      .from('order_items')
      .select('id, product_type, master_recipe_id, quote_detail_id')
      .eq('id', orderItemId)
      .eq('order_id', orderId)
      .maybeSingle()

    if (itemErr || !item) {
      return NextResponse.json({ error: 'Línea no encontrada' }, { status: 404 })
    }

    const pt = String(item.product_type || '')
    const isPumpLine = pt === 'SERVICIO DE BOMBEO'
    const masterRecipeId = item.master_recipe_id as string | null

    if (!isPumpLine && !masterRecipeId) {
      return NextResponse.json({
        success: true,
        data: { options: [], reason: 'no_master_recipe' },
      })
    }

    const { data: quotes, error: qErr } = await supabase
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        created_at,
        quote_details (
          id,
          final_price,
          pump_price,
          pump_service,
          master_recipe_id,
          recipes ( recipe_code ),
          master_recipes ( master_code )
        )
      `
      )
      .eq('client_id', order.client_id as string)
      .eq('construction_site', order.construction_site as string)
      .eq('plant_id', order.plant_id as string)
      .eq('status', 'APPROVED')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(40)

    if (qErr) {
      console.error('quote-options quotes', qErr)
      return NextResponse.json({ error: 'Error al cargar opciones' }, { status: 500 })
    }

    const { data: pRows } = await supabase
      .from('product_prices')
      .select('quote_id, master_recipe_id, is_active')
      .eq('client_id', order.client_id as string)
      .eq('construction_site', order.construction_site as string)

    const activeKey = new Set<string>()
    for (const p of pRows || []) {
      if (p.is_active && p.quote_id && p.master_recipe_id) {
        activeKey.add(`${p.quote_id}:${p.master_recipe_id}`)
      }
    }

    const options: Array<{
      quote_detail_id: string
      quote_id: string
      quote_number: string
      quote_created_at: string
      final_price: number
      recipe_code: string
      is_current_active: boolean
      is_linked_to_line: boolean
    }> = []

    for (const q of quotes || []) {
      const details = (q.quote_details || []) as Array<{
        id: string
        final_price: number | null
        pump_service?: boolean | null
        master_recipe_id: string | null
        recipes?: { recipe_code?: string }
        master_recipes?: { master_code?: string }
      }>
      for (const d of details) {
        if (isPumpLine) {
          if (!d.pump_service) continue
        } else {
          if (String(d.master_recipe_id) !== String(masterRecipeId)) continue
        }
        const mid = d.master_recipe_id as string | null
        const isActive = mid ? activeKey.has(`${q.id}:${mid}`) : false
        const code =
          d.recipes?.recipe_code || d.master_recipes?.master_code || '—'

        options.push({
          quote_detail_id: d.id,
          quote_id: q.id as string,
          quote_number: (q.quote_number as string) || String(q.id).slice(0, 8),
          quote_created_at: q.created_at as string,
          final_price: Number(d.final_price) || 0,
          recipe_code: code,
          is_current_active: isActive,
          is_linked_to_line: String(d.id) === String(item.quote_detail_id),
        })
      }
    }

    options.sort((a, b) => {
      if (a.is_linked_to_line !== b.is_linked_to_line) return a.is_linked_to_line ? -1 : 1
      if (a.is_current_active !== b.is_current_active) return a.is_current_active ? -1 : 1
      return a.quote_created_at < b.quote_created_at ? 1 : -1
    })

    return NextResponse.json({
      success: true,
      data: { options, is_pump_line: isPumpLine },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_FINANZAS' || msg === 'FORBIDDEN_PROFILE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('GET quote-options', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
