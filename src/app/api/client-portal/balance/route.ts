import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get date range from query parameters
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    
    // Determine date range strategy
    let daysToFetch: number | null = null;
    let customFromDate: string | null = null;
    let customToDate: string | null = null;
    
    if (fromParam && toParam) {
      // Custom date range
      customFromDate = fromParam;
      customToDate = toParam;
    } else if (daysParam && daysParam !== 'all') {
      // Preset days
      daysToFetch = parseInt(daysParam, 10);
    }

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user permissions - require view_prices permission
    const { data: association, error: assocError } = await supabase
      .from('client_portal_users')
      .select('role_within_client, permissions, client_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (assocError) {
      console.error('Error fetching user permissions:', assocError);
      return NextResponse.json({ error: 'Failed to verify permissions' }, { status: 500 });
    }

    if (!association) {
      return NextResponse.json(
        { error: 'No se encontró tu asociación con ningún cliente. Contacta al administrador.' },
        { status: 404 }
      );
    }

    // Executives always have permission, regular users need explicit permission
    const isExecutive = association?.role_within_client === 'executive';
    const hasViewPricesPermission = isExecutive || association?.permissions?.view_prices === true;

    if (!hasViewPricesPermission) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a información financiera. Contacta al administrador de tu organización.' },
        { status: 403 }
      );
    }

    const clientId = association.client_id;

    // Fetch all client balances (general + sites) - RLS will filter automatically
    const { data: balances, error: balancesError } = await supabase
      .from('client_balances')
      .select('*')
      .eq('client_id', clientId)
      .order('construction_site', { ascending: true, nullsFirst: true });

    if (balancesError) {
      console.error('Balance API: Balances query error:', balancesError);
    }

    // Separate general and site balances
    const generalBalance = balances?.find(b => b.construction_site === null && b.construction_site_id === null);
    const siteBalances = balances?.filter(b => b.construction_site !== null || b.construction_site_id !== null) || [];

    // Calculate date range
    let dateFromStr: string | null = null;
    let dateToStr: string | null = null;
    
    if (customFromDate && customToDate) {
      // Use custom date range
      dateFromStr = customFromDate;
      dateToStr = customToDate;
    } else if (daysToFetch) {
      // Calculate from days parameter
      const dateRangeAgo = new Date();
      dateRangeAgo.setDate(dateRangeAgo.getDate() - daysToFetch);
      dateFromStr = dateRangeAgo.toISOString();
      dateToStr = new Date().toISOString();
    }

    // Fetch recent payments for display (last 10) - RLS will filter automatically
    const { data: payments, error: paymentsError } = await supabase
      .from('client_payments')
      .select('id, amount, payment_date, payment_method, reference_number, construction_site, notes')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('Balance API: Payments query error:', paymentsError);
    }

    // Fetch payments for the selected date range for total calculation
    let paymentsQuery = supabase
      .from('client_payments')
      .select('amount, payment_date')
      .eq('client_id', clientId);
    
    if (dateFromStr) {
      paymentsQuery = paymentsQuery.gte('payment_date', dateFromStr);
    }
    if (dateToStr) {
      paymentsQuery = paymentsQuery.lte('payment_date', dateToStr);
    }

    const { data: paymentsInRange, error: paymentsRangeError } = await paymentsQuery;

    if (paymentsRangeError) {
      console.error('Balance API: Payments (range) query error:', paymentsRangeError);
    }

    // Fetch balance adjustments - RLS will filter automatically
    const { data: adjustments, error: adjustmentsError } = await supabase
      .rpc('get_client_balance_adjustments', { p_client_id: clientId });

    if (adjustmentsError) {
      console.error('Balance API: Adjustments query error:', adjustmentsError);
    }

    // Compute net adjustments (DEBT aumenta saldo, CREDIT lo reduce)
    const netAdjustments =
      (adjustments || []).reduce((sum: number, a: any) => {
        const amount = parseFloat(a.amount) || 0;
        const dir =
          a.transfer_type === 'DEBT'
            ? 1
            : a.transfer_type === 'CREDIT'
            ? -1
            : 0;
        return sum + dir * amount;
      }, 0) || 0;

    // Get orders with construction site information for the selected date range
    let ordersQuery = supabase
      .from('orders')
      .select('id, final_amount, construction_site, created_at')
      .eq('client_id', clientId);
    
    if (dateFromStr) {
      ordersQuery = ordersQuery.gte('created_at', dateFromStr);
    }
    if (dateToStr) {
      ordersQuery = ordersQuery.lte('created_at', dateToStr);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Balance API: Orders query error:', ordersError);
    }

    const orderIds = orders?.map(o => o.id) || [];
    
    // Get order items to calculate volumes (with batch processing to avoid query limits)
    let orderItems: any[] = [];
    if (orderIds.length > 0) {
      try {
        // Process in batches to avoid overwhelming the query
        const BATCH_SIZE = 100;
        const batches = [];
        
        for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
          const batchIds = orderIds.slice(i, i + BATCH_SIZE);
          batches.push(batchIds);
        }
        
        for (let i = 0; i < batches.length; i++) {
          const batchIds = batches[i];
          
          try {
            const { data: itemsData, error: itemsError } = await supabase
              .from('order_items')
              .select('order_id, volume')
              .in('order_id', batchIds);

            if (itemsError) {
              console.error(`Balance API: Order items query error for batch ${i + 1}:`, itemsError);
            } else {
              orderItems.push(...(itemsData || []));
            }
          } catch (batchError) {
            console.error(`Balance API: Batch ${i + 1} fetch failed:`, batchError instanceof Error ? batchError.message : String(batchError));
          }
        }
      } catch (error) {
        console.error('Balance API: Order items query error:', error);
      }
    }

    // Calculate volumes and monetary amounts per construction site
    const siteVolumes: Record<string, number> = {};
    const siteMonetaryAmounts: Record<string, number> = {};
    
    // Aggregate volumes from order_items by construction site
    orderItems.forEach((item: any) => {
      const order = orders?.find(o => o.id === item.order_id);
      if (order && order.construction_site) {
        const site = order.construction_site;
        const volume = parseFloat(item.volume) || 0;
        siteVolumes[site] = (siteVolumes[site] || 0) + volume;
      }
    });

    // Calculate monetary amounts per site from orders that have items
    const ordersWithItems = new Set(orderItems.map((item: any) => item.order_id));
    orders?.forEach(order => {
      if (ordersWithItems.has(order.id) && order.construction_site) {
        const site = order.construction_site;
        siteMonetaryAmounts[site] = (siteMonetaryAmounts[site] || 0) + (parseFloat(order.final_amount as any) || 0);
      }
    });

    // Calculate totals for selected date range
    const totalDeliveredVolume = orderItems.reduce((sum, item) => sum + (parseFloat(item.volume) || 0), 0);
    const totalPaid = paymentsInRange?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
    const totalConsumption = orders
      ?.filter(o => ordersWithItems.has(o.id))
      .reduce((sum, o) => sum + (parseFloat(o.final_amount as any) || 0), 0) || 0;

    // Format site balances with volumes and monetary amounts
    const sitesWithVolume = siteBalances.map(balance => ({
      site_name: balance.construction_site || 'Obra Desconocida',
      balance: parseFloat(balance.current_balance) || 0,
      volume: siteVolumes[balance.construction_site || ''] || 0,
      monetary_amount: siteMonetaryAmounts[balance.construction_site || ''] || 0
    }));

    const responseData = {
      general: {
        current_balance: parseFloat(generalBalance?.current_balance as any) || 0,
        total_delivered: totalConsumption,
        total_paid: totalPaid,
        total_volume: totalDeliveredVolume,
        total_adjustments: netAdjustments,
        expected_balance: totalConsumption - totalPaid + netAdjustments
      },
      sites: sitesWithVolume,
      recentPayments: (payments || []).map(p => ({
        id: p.id,
        amount: parseFloat(p.amount) || 0,
        payment_date: p.payment_date,
        payment_method: p.payment_method,
        reference: p.reference_number,
        construction_site: p.construction_site,
        notes: p.notes
      })),
      adjustments: (adjustments || []).slice(0, 5).map((a: any) => ({
        id: a.id,
        type: a.adjustment_type,
        amount: parseFloat(a.amount) || 0,
        created_at: a.created_at,
        notes: a.notes
      }))
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

