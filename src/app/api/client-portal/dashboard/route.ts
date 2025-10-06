import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For external clients, we need to be more careful with queries
    // Let's use a single query with joins to minimize database load

    // Fetch all data in one optimized query for external clients
    const { data: clientData, error: clientError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Additional validation for external clients
    if (clientData.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json({ error: 'Access denied. This endpoint is for external clients only.' }, { status: 403 });
    }

    // Ensure the profile has required fields
    if (!clientData.id || !clientData.email) {
      return NextResponse.json({ error: 'Invalid user profile data' }, { status: 400 });
    }

    // Get the client data for this external client
    const clientId = user.id; // Assuming user_profiles.id matches client_id for external clients

      // Get orders count for this client
      const { count: totalOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', clientId);

      // Get order IDs for this client first
      const { data: clientOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('client_id', clientId);

      const orderIds = clientOrders?.map(order => order.id) || [];

      // Get remisiones volume for this client's orders
      const { data: remisiones } = await supabase
        .from('remisiones')
        .select('volumen_fabricado, tipo_remision')
        .neq('tipo_remision', 'BOMBEO')
        .in('order_id', orderIds);

      // Get client balance
      const { data: balance } = await supabase
        .from('client_balances')
        .select('current_balance')
        .eq('client_id', clientId)
        .maybeSingle();

      // Get ensayos for this client's orders
      const { data: ensayos } = await supabase
        .from('ensayos')
        .select('porcentaje_cumplimiento')
        .in('order_id', orderIds);

      // Get recent ensayos for this client
      const { data: recentEnsayos } = await supabase
        .from('ensayos')
        .select('id, fecha_ensayo, resistencia_calculada, porcentaje_cumplimiento')
        .in('order_id', orderIds)
        .order('fecha_ensayo', { ascending: false })
        .limit(6);

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

      return NextResponse.json({
        metrics: {
          totalOrders: totalOrders || 0,
          deliveredVolume: Math.round(deliveredVolume * 10) / 10,
          currentBalance: parseFloat((balance as any)?.current_balance || '0'),
          qualityScore
        },
        recentActivity
      });
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
