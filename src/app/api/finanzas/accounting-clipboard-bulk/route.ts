import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const READ_ROLES = new Set([
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
  'ADMINISTRATIVE',
  'PLANT_MANAGER',
  'SALES_AGENT',
])

const MAX_ORDERS = 40

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, plant_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || !READ_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    let body: { order_ids?: string[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const rawIds = Array.isArray(body.order_ids) ? body.order_ids : []
    const orderIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))].slice(
      0,
      MAX_ORDERS
    )
    if (orderIds.length === 0) {
      return NextResponse.json({ error: 'order_ids requerido' }, { status: 400 })
    }

    const results: Array<{
      order_id: string
      requires_invoice: boolean
      construction_site: string
      has_empty_truck_charge: boolean
      remisiones: any[]
      order_products: any[]
    }> = []

    for (const orderId of orderIds) {
      const { data: orderData, error: oErr } = await supabase
        .from('orders')
        .select(
          `
          id,
          plant_id,
          requires_invoice,
          construction_site,
          products:order_items(*, quote_details(recipe_id, final_price, base_price, pump_service, pump_price, recipes(recipe_code), master_recipes(master_code)))
        `
        )
        .eq('id', orderId)
        .maybeSingle()

      if (oErr || !orderData) continue

      const orderRow = orderData as {
        id: string
        plant_id: string
        requires_invoice: boolean | null
        construction_site: string | null
        products: any[]
      }

      if (profile.role === 'PLANT_MANAGER' && profile.plant_id && orderRow.plant_id !== profile.plant_id) {
        continue
      }

      const structuredProducts = (orderRow.products || []).map((p: any) => {
        const recipeId =
          p.recipe_id !== null
            ? p.recipe_id
            : p.master_recipe_id
              ? null
              : (p.quote_details?.recipe_id || null)
        const { quote_details, ...productData } = p
        return {
          ...productData,
          recipe_id: recipeId,
        }
      })

      const { data: remisionesRaw, error: rErr } = await supabase
        .from('remisiones')
        .select(
          `
          *,
          recipe:recipes (
            recipe_code,
            master_recipe_id
          )
        `
        )
        .eq('order_id', orderId)
        .in('tipo_remision', ['CONCRETO', 'BOMBEO'])

      if (rErr) {
        console.error('accounting-clipboard-bulk remisiones', rErr)
        continue
      }

      const hasEmptyTruckCharge = structuredProducts.some(
        (product: any) =>
          product.has_empty_truck_charge === true || product.product_type === 'VACÍO DE OLLA'
      )

      results.push({
        order_id: orderId,
        requires_invoice: Boolean(orderRow.requires_invoice),
        construction_site: orderRow.construction_site || '',
        has_empty_truck_charge: hasEmptyTruckCharge,
        remisiones: remisionesRaw || [],
        order_products: structuredProducts,
      })
    }

    return NextResponse.json({ success: true, data: { orders: results } })
  } catch (e) {
    console.error('accounting-clipboard-bulk POST:', e)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
