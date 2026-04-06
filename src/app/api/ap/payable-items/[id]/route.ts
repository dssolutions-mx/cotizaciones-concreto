import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { userMessageForDbError } from '@/lib/procurementApiError';

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * DELETE /api/ap/payable-items/[id]
 * Removes a payable line that has no valid inventory entry (null entry_id or deleted entry),
 * only when the parent payable is still open and has no payments. Recalculates header totals
 * or deletes the payable if it was the last line.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: itemId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: line, error: lineErr } = await supabase
      .from('payable_items')
      .select('id, payable_id, entry_id, amount')
      .eq('id', itemId)
      .single();

    if (lineErr || !line) {
      return NextResponse.json({ error: 'Partida no encontrada' }, { status: 404 });
    }

    const payableId = line.payable_id as string;

    const { data: payable, error: payErr } = await supabase
      .from('payables')
      .select('id, status, plant_id, vat_rate, supplier_id, invoice_number')
      .eq('id', payableId)
      .single();

    if (payErr || !payable) {
      return NextResponse.json({ error: 'Cuenta por pagar no encontrada' }, { status: 404 });
    }

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && payable.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (payable.status !== 'open') {
      return NextResponse.json(
        {
          error:
            'Solo se pueden quitar partidas de facturas en estado Abierto. Anule o ajuste la factura por otro medio si ya tiene pagos o está cerrada.',
        },
        { status: 400 }
      );
    }

    const { count: payCount, error: payCountErr } = await supabase
      .from('payments')
      .select('id', { count: 'exact', head: true })
      .eq('payable_id', payableId);

    if (payCountErr) {
      console.error('payable-items DELETE payments count:', payCountErr);
      return NextResponse.json({ error: 'No se pudo verificar pagos' }, { status: 500 });
    }
    if ((payCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la partida: la factura ya tiene pagos registrados.' },
        { status: 400 }
      );
    }

    const entryId = line.entry_id as string | null;
    if (entryId) {
      const { data: entryRow } = await supabase.from('material_entries').select('id').eq('id', entryId).maybeSingle();
      if (entryRow) {
        return NextResponse.json(
          {
            error:
              'Esta partida sigue vinculada a una entrada de inventario. Elimine o corrija desde la entrada, no desde CXP.',
          },
          { status: 400 }
        );
      }
    }

    const { error: delErr } = await supabase.from('payable_items').delete().eq('id', itemId);
    if (delErr) {
      const hint = userMessageForDbError(delErr);
      return NextResponse.json(
        { error: hint ?? 'No se pudo eliminar la partida', detail: delErr.message },
        { status: 500 }
      );
    }

    const { data: remaining, error: remErr } = await supabase
      .from('payable_items')
      .select('amount')
      .eq('payable_id', payableId);

    if (remErr) {
      console.error('payable-items DELETE remaining fetch:', remErr);
      return NextResponse.json({ success: true, deleted_item_id: itemId, warning: 'Partida eliminada; revise totales de la factura manualmente.' });
    }

    if (!remaining || remaining.length === 0) {
      const { error: delPayErr } = await supabase.from('payables').delete().eq('id', payableId);
      if (delPayErr) {
        const hint = userMessageForDbError(delPayErr);
        return NextResponse.json(
          { error: hint ?? 'Partida eliminada pero no se pudo borrar la factura vacía', detail: delPayErr.message },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, deleted_item_id: itemId, payable_deleted: true });
    }

    const vat = Number(payable.vat_rate) || 0;
    const subtotal = roundMoney(remaining.reduce((s, r) => s + Number(r.amount) || 0, 0));
    const tax = roundMoney(subtotal * vat);
    const total = roundMoney(subtotal + tax);

    const { error: updErr } = await supabase
      .from('payables')
      .update({ subtotal, tax, total })
      .eq('id', payableId);

    if (updErr) {
      const hint = userMessageForDbError(updErr);
      return NextResponse.json(
        { error: hint ?? 'Partida eliminada pero no se pudieron actualizar los totales', detail: updErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, deleted_item_id: itemId, payable_id: payableId, subtotal, tax, total });
  } catch (err) {
    console.error('DELETE /api/ap/payable-items/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
