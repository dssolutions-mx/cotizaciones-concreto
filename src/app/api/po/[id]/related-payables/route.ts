import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/po/[id]/related-payables
 * Returns payables linked to entries that reference this PO (material or fleet)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: po } = await supabase.from('purchase_orders').select('id, plant_id').eq('id', poId).single();
    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && po.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get entries linked to this PO (po_id or fleet_po_id)
    const { data: entries } = await supabase
      .from('material_entries')
      .select('id')
      .or(`po_id.eq.${poId},fleet_po_id.eq.${poId}`);
    const entryIds = (entries || []).map(e => e.id);
    if (entryIds.length === 0) {
      return NextResponse.json({ payables: [] });
    }

    // Get payable_items for these entries, then distinct payables
    const { data: items } = await supabase
      .from('payable_items')
      .select('payable_id')
      .in('entry_id', entryIds);
    const payableIds = [...new Set((items || []).map(i => i.payable_id))];
    if (payableIds.length === 0) {
      return NextResponse.json({ payables: [] });
    }

    const { data: payables, error } = await supabase
      .from('payables')
      .select('*, supplier:suppliers!supplier_id (name)')
      .in('id', payableIds)
      .order('due_date', { ascending: true });
    if (error) return NextResponse.json({ error: 'Failed to fetch payables' }, { status: 500 });

    return NextResponse.json({ payables: payables || [] });
  } catch (err) {
    console.error('GET /api/po/[id]/related-payables error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
