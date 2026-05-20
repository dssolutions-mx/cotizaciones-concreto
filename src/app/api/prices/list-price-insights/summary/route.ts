import { NextRequest, NextResponse } from 'next/server';
import { requireListPriceInsightsAccess } from '@/lib/api/listPriceInsightsAuth';

export async function GET(request: NextRequest) {
  const access = await requireListPriceInsightsAccess();
  if ('error' in access && access.error) return access.error;
  const { supabase } = access;

  const plantId = request.nextUrl.searchParams.get('plantId');
  if (!plantId) {
    return NextResponse.json({ error: 'plantId is required' }, { status: 400 });
  }

  try {
    const [{ data: rows, error: perfError }, { data: refreshedAt, error: metaError }] =
      await Promise.all([
        supabase.from('list_price_performance').select('*').eq('plant_id', plantId),
        supabase.rpc('get_list_price_performance_refreshed_at'),
      ]);

    if (perfError) throw perfError;
    if (metaError) throw metaError;

    return NextResponse.json({
      refreshedAt: refreshedAt ?? null,
      rows: rows ?? [],
    });
  } catch (err) {
    console.error('list-price-insights/summary:', err);
    return NextResponse.json({ error: 'Error loading insights summary' }, { status: 500 });
  }
}
