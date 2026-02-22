import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !['EXECUTIVE', 'PLANT_MANAGER'].includes(profile?.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error } = await supabase
      .from('clients')
      .update({
        approval_status: 'APPROVED',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('approval_status', 'PENDING_APPROVAL');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('governance/clients/approve:', err);
    return NextResponse.json({ error: 'Error approving client' }, { status: 500 });
  }
}
