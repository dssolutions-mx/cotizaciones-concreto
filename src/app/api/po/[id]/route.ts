import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POHeaderUpdateSchema } from '@/lib/validations/po';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let query = supabase.from('purchase_orders').select('*').eq('id', params.id).single();
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('plant_id', profile.plant_id);

  const { data, error } = await query;
  if (error || !data) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  return NextResponse.json({ purchase_order: data });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const payload = POHeaderUpdateSchema.parse({ ...body, id: params.id });

  const { id, ...update } = payload as any;
  const { data, error } = await supabase
    .from('purchase_orders')
    .update(update)
    .eq('id', params.id)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update PO' }, { status: 500 });
  return NextResponse.json({ purchase_order: data });
}


