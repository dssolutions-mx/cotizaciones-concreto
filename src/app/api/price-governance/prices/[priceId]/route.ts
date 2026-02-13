import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ priceId: string }> }
) {
  try {
    const { priceId } = await params;
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
    const { is_active } = body;

    if (is_active === undefined) {
      return NextResponse.json({ error: 'is_active required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('product_prices')
      .update({
        is_active: !!is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', priceId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('price-governance/prices PATCH:', err);
    return NextResponse.json({ error: 'Error updating price' }, { status: 500 });
  }
}
