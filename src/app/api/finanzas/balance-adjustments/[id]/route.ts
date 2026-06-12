import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { insertFinanzasAuditLog } from '@/lib/finanzas/auditLog';
import { getRequestAuditMeta } from '@/lib/finanzas/auditRequestContext';

const ALLOWED_ROLES = [
  'EXECUTIVE',
  'PLANT_MANAGER',
  'CREDIT_VALIDATOR',
  'ADMIN_OPERATIONS',
  'ADMINISTRATIVE',
] as const;

async function requireAllowedRole(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, plant_id')
    .eq('id', userId)
    .single();

  const role = profile?.role as string | undefined;
  if (!role || !ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return { ok: false as const };
  }

  return { ok: true as const, role, plantId: (profile?.plant_id as string | null) ?? null };
}

type AdjustmentRow = {
  id: string;
  adjustment_type: string;
  transfer_type: string | null;
  source_client_id: string | null;
  target_client_id: string | null;
  source_site: string | null;
  target_site: string | null;
  amount: number;
  notes: string;
  created_by: string;
  created_at: string | null;
};

async function fetchAdjustment(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  id: string
): Promise<AdjustmentRow | null> {
  const { data, error } = await supabase
    .from('client_balance_adjustments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return data as AdjustmentRow;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const before = await fetchAdjustment(supabase, id);
    if (!before) return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });

    const body = await request.json();
    const { amount, notes, transfer_type, reason } = body || {};

    if (typeof amount !== 'number' || !(amount > 0)) {
      return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (!notes || typeof notes !== 'string' || !notes.trim()) {
      return NextResponse.json({ error: 'notes is required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('admin_update_client_balance_adjustment', {
      p_adjustment_id: id,
      p_amount: amount,
      p_notes: notes.trim(),
      p_transfer_type: typeof transfer_type === 'string' ? transfer_type : null,
      p_reason: typeof reason === 'string' ? reason : null,
    });

    if (error) {
      const msg = (error as { message?: string })?.message || 'Failed to update balance adjustment';
      const status = msg.toLowerCase().includes('forbidden') ? 403 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const after = (data || before) as AdjustmentRow;
    const auditMeta = getRequestAuditMeta(request);

    try {
      await insertFinanzasAuditLog({
        actor_id: user.id,
        actor_role: allowed.role,
        actor_plant_id: allowed.plantId,
        entity_type: 'client_balance_adjustment',
        entity_id: id,
        client_id: before.source_client_id,
        action: 'update',
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Corrección de ajuste de saldo',
        changes: [
          { field: 'amount', old: before.amount, new: after.amount },
          { field: 'notes', old: before.notes, new: after.notes },
          { field: 'transfer_type', old: before.transfer_type, new: after.transfer_type },
        ],
        financial_delta: {
          amount_delta: Number(after.amount) - Number(before.amount),
        },
        source: 'balance-adjustment-admin',
        request_ip: auditMeta.request_ip,
        user_agent: auditMeta.user_agent,
      });
    } catch (auditErr) {
      console.error('Balance adjustment update audit failed:', auditErr);
    }

    return NextResponse.json({ adjustment: after });
  } catch (err) {
    console.error('PATCH /api/finanzas/balance-adjustments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const allowed = await requireAllowedRole(supabase, user.id);
    if (!allowed.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const before = await fetchAdjustment(supabase, id);
    if (!before) return NextResponse.json({ error: 'Ajuste no encontrado' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const reason = searchParams.get('reason');

    const { error } = await supabase.rpc('admin_delete_client_balance_adjustment', {
      p_adjustment_id: id,
      p_reason: reason || null,
    });

    if (error) {
      const msg = (error as { message?: string })?.message || 'Failed to delete balance adjustment';
      const status = msg.toLowerCase().includes('forbidden') ? 403 : 500;
      return NextResponse.json({ error: msg }, { status });
    }

    const auditMeta = getRequestAuditMeta(request);

    try {
      await insertFinanzasAuditLog({
        actor_id: user.id,
        actor_role: allowed.role,
        actor_plant_id: allowed.plantId,
        entity_type: 'client_balance_adjustment',
        entity_id: id,
        client_id: before.source_client_id,
        action: 'delete',
        reason: reason?.trim() ? reason.trim() : 'Eliminación de ajuste de saldo',
        changes: [
          { field: 'adjustment_type', old: before.adjustment_type, new: null },
          { field: 'amount', old: before.amount, new: null },
          { field: 'transfer_type', old: before.transfer_type, new: null },
          { field: 'notes', old: before.notes, new: null },
        ],
        financial_delta: {
          amount_reversed: Number(before.amount),
        },
        source: 'balance-adjustment-admin',
        request_ip: auditMeta.request_ip,
        user_agent: auditMeta.user_agent,
      });
    } catch (auditErr) {
      console.error('Balance adjustment delete audit failed:', auditErr);
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/finanzas/balance-adjustments/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
