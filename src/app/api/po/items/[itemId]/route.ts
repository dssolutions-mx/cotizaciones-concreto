import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POItemUpdateSchema } from '@/lib/validations/po';

export async function PUT(request: NextRequest, { params }: { params: { itemId: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const payload = POItemUpdateSchema.parse({ ...body, id: params.itemId });
  const { id, ...update } = payload as any;

  const { data, error } = await supabase
    .from('purchase_order_items')
    .update(update)
    .eq('id', params.itemId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to update PO item' }, { status: 500 });
  return NextResponse.json({ item: data });
}


