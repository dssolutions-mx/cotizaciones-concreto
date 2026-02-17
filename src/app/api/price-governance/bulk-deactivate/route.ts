import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getBulkDeactivateCandidates } from './shared';

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const olderThanDays = body.olderThanDays ?? 90;
    const clientId = body.clientId || undefined;
    const plantId = body.plantId || undefined;

    const candidates = await getBulkDeactivateCandidates(supabase, {
      olderThanDays,
      clientId,
      plantId,
    });

    if (candidates.length === 0) {
      return NextResponse.json({
        deactivated: 0,
        siteIds: [],
        siteNames: [],
      });
    }

    const siteIds = candidates.map((c) => c.id);
    const siteNames = candidates.map((c) => c.site_name);

    const { error } = await supabase
      .from('construction_sites')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .in('id', siteIds);

    if (error) throw error;

    return NextResponse.json({
      deactivated: candidates.length,
      siteIds,
      siteNames,
    });
  } catch (err) {
    console.error('price-governance/bulk-deactivate POST:', err);
    return NextResponse.json(
      { error: 'Error during bulk deactivation' },
      { status: 500 }
    );
  }
}
