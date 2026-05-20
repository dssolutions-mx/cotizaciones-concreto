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
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  try {
    const { data, error } = await supabase.rpc('get_list_price_insight_detail', {
      p_list_price_id: listPriceId,
      p_from: from || null,
      p_to: to || null,
    });

    if (error) throw error;

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    console.error('list-price-insights/detail:', err);
    return NextResponse.json({ error: 'Error loading insight detail' }, { status: 500 });
  }
}
