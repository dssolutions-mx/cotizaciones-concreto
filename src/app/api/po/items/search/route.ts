import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { searchPoItems } from '@/lib/procurement/searchPoItems';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, plant_id')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const is_service = searchParams.get('is_service') === 'true';

  try {
    const items = await searchPoItems(supabase, {
      plant_id: searchParams.get('plant_id') || undefined,
      supplier_id: searchParams.get('supplier_id') || undefined,
      material_id: searchParams.get('material_id') || undefined,
      is_service: is_service ? true : searchParams.get('is_service') === 'false' ? false : undefined,
      material_supplier_id: searchParams.get('material_supplier_id') || undefined,
      po_supplier_id: searchParams.get('po_supplier_id') || undefined,
      active_po_header_only: searchParams.get('active_po_header') === 'true',
      restrict_plant_id: profile.role === 'PLANT_MANAGER' ? profile.plant_id : undefined,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[po/items/search] query error:', error);
    return NextResponse.json({ error: 'Failed to search PO items' }, { status: 500 });
  }
}
