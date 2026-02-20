import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/po/[id]/summary
 * Returns PO summary from get_po_summary() DB function (gap M4)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const allowed = ['EXECUTIVE', 'ADMINISTRATIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: po } = await supabase.from('purchase_orders').select('id, plant_id').eq('id', id).single();
    if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 });

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && po.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: rows, error } = await supabase.rpc('get_po_summary', { p_po_id: id });

    if (error) {
      console.error('get_po_summary error:', error);
      return NextResponse.json({ error: 'Failed to fetch PO summary' }, { status: 500 });
    }

    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return NextResponse.json({
        po_id: id,
        item_count: 0,
        total_ordered_value: 0,
        total_received_value: 0,
        total_credits: 0,
        net_total: 0,
      });
    }

    return NextResponse.json({
      po_id: row.po_id,
      item_count: Number(row.item_count || 0),
      total_ordered_value: Number(row.total_ordered_value || 0),
      total_received_value: Number(row.total_received_value || 0),
      total_credits: Number(row.total_credits || 0),
      net_total: Number(row.net_total || 0),
    });
  } catch (err) {
    console.error('GET /api/po/[id]/summary error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
