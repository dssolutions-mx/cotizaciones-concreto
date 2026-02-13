import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
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
    const { valid_until, is_active } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (valid_until !== undefined) {
      updates.valid_until = valid_until === null || valid_until === '' ? null : valid_until;
    }
    if (is_active !== undefined) {
      updates.is_active = !!is_active;
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await supabase
      .from('construction_sites')
      .update(updates)
      .eq('id', siteId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('price-governance/sites PATCH:', err);
    return NextResponse.json({ error: 'Error updating site' }, { status: 500 });
  }
}
