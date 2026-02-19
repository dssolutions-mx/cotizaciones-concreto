import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
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

    const [{ data: clients }, { data: construction_sites }] = await Promise.all([
      supabase
        .from('clients')
        .select('id, business_name, client_code, rfc, created_at')
        .eq('approval_status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false }),
      supabase
        .from('construction_sites')
        .select('id, name, location, client_id, created_at, latitude, longitude, clients(business_name)')
        .eq('approval_status', 'PENDING_APPROVAL')
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      clients: clients || [],
      construction_sites: construction_sites || [],
    });
  } catch (err) {
    console.error('governance/pending:', err);
    return NextResponse.json({ error: 'Error fetching pending' }, { status: 500 });
  }
}
