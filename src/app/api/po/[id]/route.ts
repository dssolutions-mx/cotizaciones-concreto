import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POHeaderUpdateSchema } from '@/lib/validations/po';
import { userMessageForDbError } from '@/lib/procurementApiError';
import { hasInventoryStandardAccess } from '@/lib/auth/inventoryRoles';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  if (!hasInventoryStandardAccess(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let query = supabase.from('purchase_orders').select('*').eq('id', id).single();
  if (profile.role !== 'EXECUTIVE' && profile.role !== 'ADMIN_OPERATIONS' && profile.plant_id) {
    query = query.eq('plant_id', profile.plant_id);
  }

  const { data, error } = await query;
  if (error || !data) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  return NextResponse.json({ purchase_order: data });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const payload = POHeaderUpdateSchema.parse({ ...body, id });

  const { id: _id, status, cancellation_reason, ...rest } = payload as any;

  // D2 — Cancellation guard (gap m7)
  if (status === 'cancelled') {
    if (!cancellation_reason || typeof cancellation_reason !== 'string' || cancellation_reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'Razón de cancelación es requerida al cancelar una orden de compra' },
        { status: 400 }
      );
    }
    const { data: items } = await supabase
      .from('purchase_order_items')
      .select('id, qty_received')
      .eq('po_id', id);
    const hasReceived = items?.some((i: any) => Number(i.qty_received || 0) > 0);
    if (hasReceived) {
      return NextResponse.json(
        { error: 'No se puede cancelar una OC que ya tiene recepciones registradas' },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = { ...rest };
  if (status !== undefined) update.status = status;
  if (cancellation_reason !== undefined) update.cancellation_reason = cancellation_reason;
  if (status === 'cancelled') {
    update.cancelled_at = new Date().toISOString();
    update.cancelled_by = user.id;
  }

  const { data, error } = await supabase
    .from('purchase_orders')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 });
  return NextResponse.json({ purchase_order: data });
}

/**
 * DELETE /api/po/[id]
 * Removes a purchase order and its line items when there are no linked receipts (material_entries)
 * and no payable_items on those lines. Unlinks material_alerts that pointed at this PO.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: po, error: poFetchErr } = await supabase
    .from('purchase_orders')
    .select('id, plant_id')
    .eq('id', id)
    .single();
  if (poFetchErr || !po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

  const { data: lineRows } = await supabase.from('purchase_order_items').select('id').eq('po_id', id);
  const itemIds = (lineRows || []).map((r) => r.id).filter(Boolean);

  const orParts = [`po_id.eq.${id}`, `fleet_po_id.eq.${id}`];
  if (itemIds.length > 0) {
    orParts.push(`po_item_id.in.(${itemIds.join(',')})`);
  }
  const entriesOr = orParts.join(',');

  const { count: entryCount, error: entryCountErr } = await supabase
    .from('material_entries')
    .select('id', { count: 'exact', head: true })
    .or(entriesOr);

  if (entryCountErr) {
    console.error('DELETE PO entry check:', entryCountErr);
    return NextResponse.json({ error: 'No se pudo verificar entradas vinculadas' }, { status: 500 });
  }
  if ((entryCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'No se puede eliminar esta OC porque tiene entradas de inventario vinculadas (recepciones o flota).',
      },
      { status: 400 }
    );
  }

  if (itemIds.length > 0) {
    const { count: piCount, error: piErr } = await supabase
      .from('payable_items')
      .select('id', { count: 'exact', head: true })
      .in('po_item_id', itemIds);

    if (piErr) {
      console.error('DELETE PO payable_items check:', piErr);
      return NextResponse.json({ error: 'No se pudo verificar facturas (CXP) vinculadas' }, { status: 500 });
    }
    if ((piCount ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            'No se puede eliminar esta OC porque tiene partidas de cuentas por pagar vinculadas a sus líneas.',
        },
        { status: 400 }
      );
    }
  }

  const { error: alertUnlinkErr } = await supabase
    .from('material_alerts')
    .update({ existing_po_id: null })
    .eq('existing_po_id', id);

  if (alertUnlinkErr) {
    console.warn('DELETE PO: could not unlink alerts (continuing):', alertUnlinkErr.message);
  }

  // RLS: delete() often returns error=null even when zero rows are removed. Require a returned row.
  const { data: deletedPo, error: delErr } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (delErr) {
    const hint = userMessageForDbError(delErr);
    return NextResponse.json(
      { error: hint ?? 'No se pudo eliminar la orden de compra', detail: delErr.message },
      { status: 500 }
    );
  }

  if (!deletedPo) {
    return NextResponse.json(
      {
        error:
          'La orden no se eliminó en la base de datos (0 filas). Suele deberse a que en Supabase no hay política RLS de DELETE en purchase_orders y purchase_order_items. Aplique la migración supabase/migrations/20260328210000_purchase_orders_delete_rls.sql o cree políticas equivalentes para roles EXECUTIVE / ADMIN_OPERATIONS.',
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, id: deletedPo.id });
}


