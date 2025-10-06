import { createServerSupabaseClient, createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('Dashboard API: Auth error:', authError);
      console.error('Dashboard API: Request headers:', Object.fromEntries(request.headers.entries()));
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get orders count - RLS will automatically filter by client_id
    const { count: totalOrders, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    if (ordersError) {
      console.error('Dashboard API: Orders query error:', ordersError);
    }

    // Get order IDs for this client - RLS will automatically filter
    const { data: clientOrders, error: clientOrdersError } = await supabase
      .from('orders')
      .select('id');

    if (clientOrdersError) {
      console.error('Dashboard API: Client orders query error:', clientOrdersError);
    }

    const orderIds = clientOrders?.map(order => order.id) || [];

    // Get remisiones volume - RLS will automatically filter through order relationship
    const { data: remisiones, error: remisionesError } = await supabase
      .from('remisiones')
      .select('volumen_fabricado, tipo_remision')
      .neq('tipo_remision', 'BOMBEO')
      .in('order_id', orderIds);

    if (remisionesError) {
      console.error('Dashboard API: Remisiones query error:', remisionesError);
    }

    // Get client balance - RLS will automatically filter by client_id
    const { data: balance, error: balanceError } = await supabase
      .from('client_balances')
      .select('current_balance')
      .maybeSingle();

    if (balanceError) {
      console.error('Dashboard API: Balance query error:', balanceError);
    }

    const currentBalance = balance?.current_balance || 0;

    // Get ensayos - RLS will automatically filter through order relationship
    const { data: ensayos, error: ensayosError } = await supabase
      .from('ensayos')
      .select('porcentaje_cumplimiento')
      .in('order_id', orderIds);

    if (ensayosError) {
      console.error('Dashboard API: Ensayos query error:', ensayosError);
    }

    // Get recent ensayos - RLS will automatically filter through order relationship
    const { data: recentEnsayos, error: recentEnsayosError } = await supabase
      .from('ensayos')
      .select('id, fecha_ensayo, resistencia_calculada, porcentaje_cumplimiento')
      .in('order_id', orderIds)
      .order('fecha_ensayo', { ascending: false })
      .limit(6);

    if (recentEnsayosError) {
      console.error('Dashboard API: Recent ensayos query error:', recentEnsayosError);
    }

    const deliveredVolume = remisiones?.reduce(
      (sum, r) => sum + (parseFloat(r.volumen_fabricado) || 0),
      0
    ) || 0;

    const qualityScore = ensayos?.length
      ? Math.round(ensayos.reduce((sum, e) => sum + (parseFloat(e.porcentaje_cumplimiento) || 0), 0) / ensayos.length)
      : 0;

    const recentActivity = (recentEnsayos || []).map((e: any) => {
      const pct = parseFloat(e.porcentaje_cumplimiento || '0') || 0;
      const status = pct >= 95 ? 'success' : pct >= 85 ? 'warning' : 'error';
      return {
        id: e.id,
        type: 'quality',
        title: 'Ensayo de calidad',
        description: `Resistencia ${e.resistencia_calculada ?? '-'} · ${pct}% cumplimiento`,
        timestamp: e.fecha_ensayo,
        status
      };
    });

    // Ensure we always return valid data structure
    const responseData = {
      metrics: {
        totalOrders: totalOrders || 0,
        deliveredVolume: Math.round(deliveredVolume * 10) / 10,
        currentBalance,
        qualityScore
      },
      recentActivity
    };

    console.log('Dashboard API: Returning data:', responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
