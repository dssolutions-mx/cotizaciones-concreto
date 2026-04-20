import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  assertOrderAccess,
  requireFinanzasAuditContext,
} from '@/lib/finanzas/auditRequestContext'

function concreteMasterIdsFromItems(
  items: Array<{ product_type?: string | null; master_recipe_id?: string | null }>
): Set<string> {
  const s = new Set<string>()
  for (const it of items) {
    const pt = String(it.product_type || '')
    if (
      pt === 'VACÍO DE OLLA' ||
      pt === 'SERVICIO DE BOMBEO' ||
      pt.startsWith('PRODUCTO ADICIONAL:')
    ) {
      continue
    }
    const mid = it.master_recipe_id
    if (mid) s.add(String(mid))
  }
  return s
}

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

    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_type, master_recipe_id')
      .eq('order_id', orderId)

    const neededMasters = concreteMasterIdsFromItems(orderItems || [])
    const totalRecipes = neededMasters.size

    const { data: quotes, error: qErr } = await supabase
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        status,
        created_at,
        plant_id,
        client_id,
        construction_site,
        quote_details (
          id,
          master_recipe_id,
          final_price,
          pump_service,
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
      .limit(80)

    if (qErr) {
      console.error('quote-candidates', qErr)
      return NextResponse.json({ error: 'Error al cargar cotizaciones' }, { status: 500 })
    }

    const candidates = (quotes || []).map((q) => {
      const details = (q.quote_details || []) as Array<{
        id: string
        master_recipe_id: string | null
        final_price: number | null
        pump_service?: boolean | null
        recipes?: { recipe_code?: string }
        master_recipes?: { master_code?: string }
      }>

      const mastersInQuote = new Set<string>()
      let detailSum = 0
      const line_preview: Array<{ recipe_code: string; final_price: number }> = []

      for (const d of details) {
        if (d.pump_service) continue
        const mid = d.master_recipe_id
        if (!mid) continue
        mastersInQuote.add(String(mid))
        const code =
          d.recipes?.recipe_code || d.master_recipes?.master_code || String(mid).slice(0, 8)
        const fp = Number(d.final_price) || 0
        detailSum += fp
        if (line_preview.length < 8) {
          line_preview.push({ recipe_code: code, final_price: fp })
        }
      }

      let recipes_covered = 0
      for (const m of neededMasters) {
        if (mastersInQuote.has(m)) recipes_covered += 1
      }

      const matches_order_recipes = totalRecipes > 0 && recipes_covered === totalRecipes

      return {
        id: q.id as string,
        quote_number: (q.quote_number as string) || String(q.id).slice(0, 8),
        status: q.status as string,
        created_at: q.created_at as string,
        line_preview,
        recipes_covered,
        total_recipes_needed: totalRecipes,
        matches_order_recipes,
        total: detailSum,
      }
    })

    candidates.sort((a, b) => {
      if (b.recipes_covered !== a.recipes_covered) return b.recipes_covered - a.recipes_covered
      return a.created_at < b.created_at ? 1 : -1
    })

    return NextResponse.json({
      success: true,
      data: { candidates },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_FINANZAS' || msg === 'FORBIDDEN_PROFILE') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('GET quote-candidates', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
