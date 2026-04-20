import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestAuditMeta, requireFinanzasAuditContext } from '@/lib/finanzas/auditRequestContext'
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog'

type Body = {
  base_price?: number
  is_active?: boolean
  reason?: string
  preview?: boolean
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: priceId } = await params
    const ctx = await requireFinanzasAuditContext(request, { requireWriter: true })
    const admin = createAdminClient()

    let body: Body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const preview =
      Boolean(body.preview) || request.nextUrl.searchParams.get('preview') === '1'

    const { data: row, error: rErr } = await admin
      .from('product_prices')
      .select(
        'id, base_price, is_active, client_id, construction_site, master_recipe_id, recipe_id, plant_id'
      )
      .eq('id', priceId)
      .maybeSingle()

    if (rErr || !row) {
      return NextResponse.json({ error: 'Precio no encontrado' }, { status: 404 })
    }

    const patch: Record<string, unknown> = {}
    if (typeof body.base_price === 'number') patch.base_price = body.base_price
    if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
    if (typeof body.is_active === 'boolean' && body.is_active) {
      const { data: activeSibling } = await admin
        .from('product_prices')
        .select('id')
        .eq('client_id', row.client_id as string)
        .eq('construction_site', row.construction_site as string)
        .eq('is_active', true)
        .eq('master_recipe_id', row.master_recipe_id as string)
        .neq('id', priceId)
        .maybeSingle()
      if (activeSibling?.id) {
        return NextResponse.json(
          {
            error:
              'Ya existe un precio activo para esta receta y obra. Use el endpoint de intercambio (swap).',
            active_id: activeSibling.id,
          },
          { status: 409 }
        )
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
    }

    const changes = Object.entries(patch).map(([field, newVal]) => ({
      field: `product_price.${priceId}.${field}`,
      old: (row as Record<string, unknown>)[field],
      new: newVal,
    }))

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        data: { product_price_id: priceId, patch },
      })
    }

    const reason =
      typeof body.reason === 'string' && body.reason.trim().length >= 10
        ? body.reason.trim()
        : null
    if (!reason) {
      return NextResponse.json({ error: 'Motivo debe tener al menos 10 caracteres' }, { status: 400 })
    }

    patch.updated_at = new Date().toISOString()

    const { error: upErr } = await admin.from('product_prices').update(patch).eq('id', priceId)
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 400 })
    }

    const meta = getRequestAuditMeta(request)
    await insertFinanzasAuditLog(
      {
        actor_id: ctx.profile.id,
        actor_role: ctx.profile.role,
        actor_plant_id: ctx.profile.plant_id,
        entity_type: 'product_price',
        entity_id: priceId,
        client_id: row.client_id as string,
        action: 'update',
        reason,
        changes,
        flags: { used_inactive: row.is_active === false && patch.is_active === true },
        request_ip: meta.request_ip,
        user_agent: meta.user_agent,
      },
      admin
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error'
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN_WRITER' || msg === 'FORBIDDEN_FINANZAS') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    console.error('PATCH product-price', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
