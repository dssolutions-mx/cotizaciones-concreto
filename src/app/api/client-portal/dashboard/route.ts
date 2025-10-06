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

    // Get delivered volume from order_items - more efficient than remisiones
    // RLS will automatically filter through the orders relationship
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('concrete_volume_delivered, volume');

    if (orderItemsError) {
      console.error('Dashboard API: Order items query error:', orderItemsError);
    }

    // Calculate total delivered volume from order_items
    const deliveredVolume = orderItems?.reduce(
      (sum, item) => sum + (parseFloat(item.concrete_volume_delivered as any) || 0),
      0
    ) || 0;

    // Get client balance - RLS will automatically filter by client_id
    // Filter for GENERAL balance only (both construction_site and construction_site_id must be NULL)
    const { data: balance, error: balanceError } = await supabase
      .from('client_balances')
      .select('current_balance')
      .is('construction_site', null)
      .is('construction_site_id', null)
      .maybeSingle();

    if (balanceError) {
      console.error('Dashboard API: Balance query error:', balanceError);
    }

    const currentBalance = balance?.current_balance || 0;

    // Get recent activity: orders, payments, and quality tests
    let recentActivity: any[] = [];
    let validEnsayos: any[] = [];

    try {
      // 1. Get recent orders (last 10)
      const { data: recentOrders } = await supabase
        .from('orders')
        .select('id, order_number, delivery_date, total_amount, order_status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      // 2. Get recent payments (last 10)
      const { data: recentPayments } = await supabase
        .from('client_payments')
        .select('id, amount, payment_date, payment_method, created_at')
        .order('payment_date', { ascending: false })
        .limit(10);

      // 3. Get quality data for quality score
      const { data: clientOrders } = await supabase
        .from('orders')
        .select('id');

      const orderIds = clientOrders?.map(o => o.id) || [];

      // Get recent quality tests
      if (orderIds.length > 0) {
        const { data: remisiones } = await supabase
          .from('remisiones')
          .select('id')
          .in('order_id', orderIds);

        const remisionIds = remisiones?.map(r => r.id) || [];

        if (remisionIds.length > 0) {
          const { data: muestreos } = await supabase
            .from('muestreos')
            .select('id')
            .in('remision_id', remisionIds);

          const muestreoIds = muestreos?.map(m => m.id) || [];

          if (muestreoIds.length > 0) {
            const { data: muestras } = await supabase
              .from('muestras')
              .select('id')
              .in('muestreo_id', muestreoIds);

            const muestraIds = muestras?.map(m => m.id) || [];

            if (muestraIds.length > 0) {
              const { data: ensayos } = await supabase
                .from('ensayos')
                .select('id, fecha_ensayo, resistencia_calculada, porcentaje_cumplimiento, created_at')
                .in('muestra_id', muestraIds)
                .not('porcentaje_cumplimiento', 'is', null)
                .order('fecha_ensayo', { ascending: false })
                .limit(100);

              validEnsayos = ensayos || [];
            }
          }
        }
      }

      // Transform orders to activity items
      const orderActivities = (recentOrders || []).map((order: any) => ({
        id: order.id,
        type: 'order',
        title: `Pedido ${order.order_number}`,
        description: `$${parseFloat(order.total_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        timestamp: order.created_at,
        status: order.order_status === 'completed' ? 'success' : 'pending',
        sortDate: new Date(order.created_at)
      }));

      // Transform payments to activity items
      const paymentActivities = (recentPayments || []).map((payment: any) => ({
        id: payment.id,
        type: 'payment',
        title: 'Pago recibido',
        description: `$${parseFloat(payment.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })} · ${payment.payment_method}`,
        timestamp: payment.payment_date,
        status: 'success',
        sortDate: new Date(payment.payment_date)
      }));

      // Transform quality tests to activity items (only recent ones)
      const qualityActivities = validEnsayos.slice(0, 10).map((e: any) => {
        const pct = parseFloat(e.porcentaje_cumplimiento || '0') || 0;
        const status = pct >= 95 ? 'success' : pct >= 85 ? 'warning' : 'error';
        return {
          id: e.id,
          type: 'quality',
          title: 'Ensayo completado',
          description: `${e.resistencia_calculada ?? '-'} kg/cm² · ${pct}%`,
          timestamp: e.fecha_ensayo,
          status,
          sortDate: new Date(e.created_at || e.fecha_ensayo)
        };
      });

      // Combine all activities, sort by date, and take top 10
      recentActivity = [...orderActivities, ...paymentActivities, ...qualityActivities]
        .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
        .slice(0, 10)
        .map(({ sortDate, ...item }) => item); // Remove sortDate from final output

    } catch (error) {
      console.error('Dashboard API: Recent activity query error:', error);
      // Continue with empty activity data rather than failing
    }

    // Calculate quality score from all ensayos
    const qualityScore = validEnsayos.length
      ? Math.round(validEnsayos.reduce((sum, e) => sum + (parseFloat(e.porcentaje_cumplimiento) || 0), 0) / validEnsayos.length)
      : 0;

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
