import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { withProcurementTiming } from '@/lib/procurement/observability';

/**
 * GET /api/ap/payables/[id]/validate
 * Returns 3-way match validation warnings for a payable (PO vs receipt vs invoice)
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

    const allowed = ['EXECUTIVE', 'ADMIN_OPERATIONS', 'PLANT_MANAGER'];
    if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: payable } = await supabase.from('payables').select('id, plant_id').eq('id', id).single();
    if (!payable) return NextResponse.json({ error: 'Payable not found' }, { status: 404 });

    if (profile.role === 'PLANT_MANAGER' && profile.plant_id && payable.plant_id !== profile.plant_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: warnings, error } = await withProcurementTiming(
      'payable-validate',
      () => supabase.rpc('validate_payable_vs_po', { p_payable_id: id }),
      { role: profile.role, plant_id: payable.plant_id }
    );
    if (error) {
      console.error('validate_payable_vs_po error:', error);
      return NextResponse.json({ error: 'Validation failed', warnings: [] }, { status: 200 });
    }
    const list = Array.isArray(warnings) ? warnings : [];
    if (list.length > 0) {
      console.warn('[procurement]', JSON.stringify({
        module: 'procurement',
        endpoint: 'payable-validate',
        payable_id: id,
        warning_count: list.length,
        ts: new Date().toISOString(),
      }));
    }
    return NextResponse.json({ warnings: list });
  } catch (err) {
    console.error('GET /api/ap/payables/[id]/validate error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
