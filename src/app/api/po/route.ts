import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POHeaderInputSchema } from '@/lib/validations/po';
import { userMessageForDbError } from '@/lib/procurementApiError';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const plant_id = searchParams.get('plant_id') || undefined;
  const supplier_id = searchParams.get('supplier_id') || undefined;
  const status = searchParams.get('status') || undefined;
  const date_from = searchParams.get('date_from') || undefined;
  const date_to = searchParams.get('date_to') || undefined;
  const po_number = searchParams.get('po_number') || undefined;
  const payment_terms_days = searchParams.get('payment_terms_days') || undefined;

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

  let query = supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers!supplier_id (id, name), plant:plants!plant_id (id, name, code)', { count: 'exact' });
  if (plant_id) query = query.eq('plant_id', plant_id);
  if (supplier_id) query = query.eq('supplier_id', supplier_id);
  if (payment_terms_days) query = query.eq('payment_terms_days', parseInt(payment_terms_days));
  if (status && status !== 'all') {
    // DB uses 'closed' for completed POs; 'fulfilled' and 'closed' are both "completed"
    if (status === 'fulfilled') {
      query = query.in('status', ['fulfilled', 'closed']);
    } else if (status === 'active') {
      query = query.in('status', ['open', 'partial']);
    } else {
      query = query.eq('status', status);
    }
  }
  if (date_from) query = query.gte('po_date', date_from);
  if (date_to) query = query.lte('po_date', date_to);
  if (po_number) query = query.ilike('po_number', `%${po_number}%`);
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('plant_id', profile.plant_id);

  const { data, error, count } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  if (error) {
    const hint = userMessageForDbError(error);
    return NextResponse.json(
      { error: hint ?? 'No se pudieron cargar las órdenes de compra', detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    purchase_orders: data || [],
    total_count: count ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const payload = POHeaderInputSchema.parse(body);

  const insertData: Record<string, unknown> = {
    ...payload,
    created_by: user.id,
  };
  if (payload.po_date) insertData.po_date = payload.po_date;
  else insertData.po_date = new Date().toISOString().slice(0, 10);
  if (payload.payment_terms_days != null) insertData.payment_terms_days = payload.payment_terms_days;
  else insertData.payment_terms_days = 30;

  const { data, error } = await supabase
    .from('purchase_orders')
    .insert(insertData)
    .select('*')
    .single();

  if (error) {
    const hint = userMessageForDbError(error);
    return NextResponse.json(
      { error: hint ?? 'No se pudo crear la orden de compra', detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ purchase_order: data }, { status: 201 });
}


