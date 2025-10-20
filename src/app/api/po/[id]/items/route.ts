import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { POItemInputSchema } from '@/lib/validations/po';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Ensure PO exists and belongs to the same plant for plant managers
  let poQuery = supabase.from('purchase_orders').select('id, plant_id').eq('id', params.id).single();
  const { data: po } = await poQuery;
  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id && po.plant_id !== profile.plant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase.from('purchase_order_items').select('*').eq('po_id', params.id).order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed to fetch PO items' }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const payload = POItemInputSchema.parse({ ...body, po_id: params.id });

  if (!payload.is_service && !payload.uom) {
    return NextResponse.json({ error: 'UoM es requerido para materiales' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('purchase_order_items')
    .insert({
      po_id: params.id,
      is_service: payload.is_service,
      material_id: payload.material_id ?? null,
      uom: payload.uom ?? null,
      qty_ordered: payload.qty_ordered,
      unit_price: payload.unit_price,
      required_by: payload.required_by ?? null,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Failed to create PO item' }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}


