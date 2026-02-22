import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Orders count
    const { count: orders } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true });

    // Volume (exclude BOMBEO to match ventas logic)
    const { data: rems } = await supabase
      .from('remisiones')
      .select('volumen_fabricado, tipo_remision')
      .limit(1000);
    const deliveredVolume = (rems || []).reduce((sum: number, r: any) => {
      if (r.tipo_remision === 'BOMBEO') return sum;
      return sum + (Number(r.volumen_fabricado) || 0);
    }, 0);

    // Balance (general)
    const { data: balance } = await supabase
      .from('client_balances')
      .select('current_balance')
      .is('construction_site', null)
      .is('construction_site_id', null)
      .limit(1)
      .maybeSingle();

    // Recent remisiones (5)
    const { data: latest } = await supabase
      .from('remisiones')
      .select('id, fecha, volumen_fabricado, tipo_remision, remision_number')
      .order('fecha', { ascending: false })
      .limit(5);

    return NextResponse.json({
      orders: orders || 0,
      deliveredVolume,
      currentBalance: Number((balance as any)?.current_balance || 0),
      recent: (latest || []).map((r: any) => ({
        id: r.id,
        fecha: r.fecha,
        volumen: Number(r.volumen_fabricado) || 0,
        tipo: r.tipo_remision,
        remisionNumber: r.remision_number,
      }))
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load metrics' }, { status: 500 });
  }
}


