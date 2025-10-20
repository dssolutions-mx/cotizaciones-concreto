import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const plant_id = searchParams.get('plant_id') || undefined;
  const supplier_id = searchParams.get('supplier_id') || undefined;
  const material_id = searchParams.get('material_id') || undefined;

  // Base: open or partial items, with header join
  let query = supabase
    .from('purchase_order_items')
    .select('*, po:purchase_orders!po_id (id, plant_id, supplier_id, status), material:materials!material_id (id, material_name, density_kg_per_l)')
    .in('status', ['open', 'partial']);

  if (plant_id) query = query.eq('po.plant_id', plant_id as any);
  if (supplier_id) query = query.eq('po.supplier_id', supplier_id as any);
  if (material_id) query = query.eq('material_id', material_id as any);
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) query = query.eq('po.plant_id', profile.plant_id as any);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'Failed to search PO items' }, { status: 500 });

  // Compute remaining kg server-side for convenience
  const items = (data || []).map((it: any) => {
    let orderedKg = Number(it.qty_ordered) || 0;
    if (!it.is_service && it.uom === 'l') {
      const density = Number(it.material?.density_kg_per_l) || 0;
      if (density) orderedKg *= density;
    }
    const receivedKg = Number(it.qty_received_kg) || 0;
    const remainingKg = Math.max(orderedKg - receivedKg, 0);
    return { ...it, orderedKg, receivedKg, remainingKg };
  }).filter((it: any) => it.remainingKg > 0);

  return NextResponse.json({ items });
}


