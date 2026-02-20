import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POHeaderInputSchema } from '@/lib/validations/po';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const plant_id = searchParams.get('plant_id') || undefined;
  const supplier_id = searchParams.get('supplier_id') || undefined;
  const status = searchParams.get('status') || undefined;

  let query = supabase.from('purchase_orders').select('*, supplier:suppliers!supplier_id (id, name), plant:plants!plant_id (id, name, code)').order('created_at', { ascending: false });
  if (plant_id) query = query.eq('plant_id', plant_id);
  if (supplier_id) query = query.eq('supplier_id', supplier_id);
  if (status && status !== 'all') {
    // DB uses 'closed' for completed POs; map 'fulfilled' filter to both
    if (status === 'fulfilled') {
      query = query.in('status', ['fulfilled', 'closed']);
    } else {
      query = query.eq('status', status);
    }
  }
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('plant_id', profile.plant_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to fetch POs' }, { status: 500 });
  return NextResponse.json({ purchase_orders: data || [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE'];
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

  if (error) return NextResponse.json({ error: 'Failed to create PO' }, { status: 500 });
  return NextResponse.json({ purchase_order: data }, { status: 201 });
}


