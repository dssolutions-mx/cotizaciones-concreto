import { NextRequest, NextResponse } from 'next/server';
import { requireListPriceInsightsAccess } from '@/lib/api/listPriceInsightsAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listPriceId: string }> },
) {
  const access = await requireListPriceInsightsAccess();
  if ('error' in access && access.error) return access.error;
  const { supabase } = access;

  const { listPriceId } = await params;
  const plantId = request.nextUrl.searchParams.get('plantId');
  const grain = request.nextUrl.searchParams.get('grain') ?? 'month';

  if (!plantId) {
    return NextResponse.json({ error: 'plantId is required' }, { status: 400 });
  }

  try {
    const { data: lpRow, error: lpError } = await supabase
      .from('list_prices')
      .select('master_recipe_id')
      .eq('id', listPriceId)
      .single();

    if (lpError || !lpRow?.master_recipe_id) {
      return NextResponse.json({ error: 'List price not found' }, { status: 404 });
    }

    const { data, error } = await supabase.rpc('get_list_price_insight_trend', {
      p_master_recipe_id: lpRow.master_recipe_id,
      p_plant_id: plantId,
      p_grain: grain,
    });

    if (error) throw error;

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    console.error('list-price-insights/trend:', err);
    return NextResponse.json({ error: 'Error loading insight trend' }, { status: 500 });
  }
}
