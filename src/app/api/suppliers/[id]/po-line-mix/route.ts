import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/suppliers/[id]/po-line-mix?plant_id=...
 * Returns whether this supplier has historical PO lines as material-only, fleet-only, or mixed (for UX hints).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: supplierId } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowedRoles = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER', 'DOSIFICADOR', 'QUALITY_TEAM'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    if (!plantId) {
      return NextResponse.json({ error: 'plant_id is required' }, { status: 400 });
    }

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && profile.plant_id !== plantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: pos, error: poErr } = await supabase
      .from('purchase_orders')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('plant_id', plantId);

    if (poErr) {
      console.error('po-line-mix purchase_orders:', poErr);
      return NextResponse.json({ error: 'Failed to load supplier history' }, { status: 500 });
    }

    const poIds = (pos || []).map((p) => p.id);
    if (poIds.length === 0) {
      return NextResponse.json({
        has_fleet_lines: false,
        has_material_lines: false,
        fleet_only: false,
        material_only: false,
        sample_count: 0,
      });
    }

    const { data: items, error: itErr } = await supabase
      .from('purchase_order_items')
      .select('is_service')
      .in('po_id', poIds)
      .limit(500);

    if (itErr) {
      console.error('po-line-mix items:', itErr);
      return NextResponse.json({ error: 'Failed to load supplier history' }, { status: 500 });
    }

    let hasFleet = false;
    let hasMaterial = false;
    for (const it of items || []) {
      if ((it as { is_service?: boolean }).is_service) hasFleet = true;
      else hasMaterial = true;
    }

    return NextResponse.json({
      has_fleet_lines: hasFleet,
      has_material_lines: hasMaterial,
      fleet_only: hasFleet && !hasMaterial,
      material_only: hasMaterial && !hasFleet,
      sample_count: (items || []).length,
    });
  } catch (e) {
    console.error('GET /api/suppliers/[id]/po-line-mix', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
