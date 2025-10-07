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

    // Get delivered volume from order_items for current month only
    // RLS will automatically filter through the orders relationship
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const firstDayStr = firstDayOfMonth.toISOString().split('T')[0];
    const lastDayStr = lastDayOfMonth.toISOString().split('T')[0];

    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('concrete_volume_delivered, orders!inner(delivery_date)')
      .gte('orders.delivery_date', firstDayStr)
      .lte('orders.delivery_date', lastDayStr);

    if (orderItemsError) {
      console.error('Dashboard API: Order items query error:', orderItemsError);
    }

    // Calculate delivered volume for current month
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

    // Get client_id for RPC call
    const { data: clientData } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_user_id', user.id)
      .single();

    const clientId = clientData?.id;

    // Get quality score using the same RPC function as quality page
    let qualityScore = 0;
    if (clientId) {
      // Get quality summary from last 90 days
      const toDate = new Date().toISOString().split('T')[0];
      const fromDate = (() => {
        const date = new Date();
        date.setDate(date.getDate() - 90);
        return date.toISOString().split('T')[0];
      })();

      const { data: qualitySummary, error: qualityError } = await supabase
        .rpc('get_client_quality_summary', {
          p_client_id: clientId,
          p_from_date: fromDate,
          p_to_date: toDate
        })
        .single();

      if (!qualityError && qualitySummary) {
        qualityScore = Math.round(Number(qualitySummary.avg_compliance) || 0);
      }
    }

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

      // 3. Get recent quality tests for activity feed only (using optimized query)
      if (clientId) {
        const toDateActivity = new Date().toISOString().split('T')[0];
        const fromDateActivity = (() => {
          const date = new Date();
          date.setDate(date.getDate() - 30);
          return date.toISOString().split('T')[0];
        })();

        const { data: qualityDetails } = await supabase
          .rpc('get_client_quality_details', {
            p_client_id: clientId,
            p_from_date: fromDateActivity,
            p_to_date: toDateActivity,
            p_limit: 50,
            p_offset: 0
          });

        // Extract ensayos from quality details for activity feed
        if (qualityDetails && qualityDetails.length > 0) {
          validEnsayos = qualityDetails
            .flatMap((r: any) => 
              (r.muestreos || []).flatMap((m: any) => 
                (m.muestras || []).flatMap((mu: any) => 
                  (mu.ensayos || []).map((e: any) => ({
                    id: e.id,
                    fecha_ensayo: e.fechaEnsayo,
                    resistencia_calculada: e.resistenciaCalculada,
                    porcentaje_cumplimiento: e.porcentajeCumplimiento,
                    created_at: e.fechaEnsayo
                  }))
                )
              )
            )
            .filter((e: any) => e.porcentaje_cumplimiento != null)
            .sort((a: any, b: any) => new Date(b.fecha_ensayo).getTime() - new Date(a.fecha_ensayo).getTime())
            .slice(0, 10);
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
