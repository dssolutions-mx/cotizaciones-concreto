import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getBulkDeactivateCandidates } from '../shared';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!['EXECUTIVE', 'PLANT_MANAGER'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const olderThanDays = parseInt(
      searchParams.get('olderThanDays') || '90',
      10
    );
    const clientId = searchParams.get('client_id') || undefined;
    const plantId = searchParams.get('plant_id') || undefined;

    const candidates = await getBulkDeactivateCandidates(supabase, {
      olderThanDays,
      clientId,
      plantId,
    });

    return NextResponse.json({
      candidates,
      count: candidates.length,
    });
  } catch (err) {
    console.error('price-governance/bulk-deactivate/preview GET:', err);
    return NextResponse.json(
      { error: 'Error fetching bulk deactivate preview' },
      { status: 500 }
    );
  }
}
