import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestAuditMeta, requireFinanzasAuditContext } from '@/lib/finanzas/auditRequestContext'
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog'

type Body = {
  activate_id: string
  deactivate_id?: string | null
  reason?: string
  preview?: boolean
}

export async function POST(request: NextRequest) {
  try {
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

    const activateId = typeof body.activate_id === 'string' ? body.activate_id.trim() : ''
    if (!activateId) {
      return NextResponse.json({ error: 'activate_id requerido' }, { status: 400 })
    }

    const { data: activateRow, error: aErr } = await admin
      .from('product_prices')
      .select(
        'id, client_id, construction_site, master_recipe_id, is_active, base_price, plant_id'
      )
      .eq('id', activateId)
      .maybeSingle()

    if (aErr || !activateRow) {
      return NextResponse.json({ error: 'Precio a activar no encontrado' }, { status: 404 })
    }

    let deactivateId = typeof body.deactivate_id === 'string' ? body.deactivate_id.trim() : ''
    if (!deactivateId) {
      const { data: current } = await admin
        .from('product_prices')
        .select('id')
        .eq('client_id', activateRow.client_id as string)
        .eq('construction_site', activateRow.construction_site as string)
        .eq('master_recipe_id', activateRow.master_recipe_id as string)
        .eq('is_active', true)
        .neq('id', activateId)
        .maybeSingle()
      deactivateId = (current?.id as string) || ''
    }

    if (preview) {
      return NextResponse.json({
        success: true,
        preview: true,
        data: {
          activate_id: activateId,
          deactivate_id: deactivateId || null,
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

    const now = new Date().toISOString()

    if (deactivateId) {
      const { error: dErr } = await admin
        .from('product_prices')
        .update({ is_active: false, updated_at: now })
        .eq('id', deactivateId)
      if (dErr) {
        return NextResponse.json({ error: dErr.message }, { status: 400 })
      }
    }

    const { error: uErr } = await admin
      .from('product_prices')
      .update({ is_active: true, updated_at: now })
      .eq('id', activateId)
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 400 })
    }

    const meta = getRequestAuditMeta(request)
    await insertFinanzasAuditLog(
      {
        actor_id: ctx.profile.id,
        actor_role: ctx.profile.role,
        actor_plant_id: ctx.profile.plant_id,
        entity_type: 'product_price_swap',
        entity_id: activateId,
        client_id: activateRow.client_id as string,
        action: 'swap',
        reason,
        changes: [
          { field: 'activate_id', old: false, new: true },
          { field: 'deactivate_id', old: true, new: false },
        ],
        flags: {
          activate_id: activateId,
          deactivate_id: deactivateId || null,
        },
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
    console.error('POST product-price swap', e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
