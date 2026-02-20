import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POHeaderUpdateSchema } from '@/lib/validations/po';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let query = supabase.from('purchase_orders').select('*').eq('id', id).single();
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('plant_id', profile.plant_id);

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

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE'];
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


