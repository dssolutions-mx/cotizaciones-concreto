import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get client_id from user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .eq('role', 'EXTERNAL_CLIENT')
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Get client record to find client_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('portal_user_id', user.id)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const clientId = client.id;

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

    // Fetch recent payments - RLS will filter automatically
    const { data: payments, error: paymentsError } = await supabase
      .from('client_payments')
      .select('id, amount, payment_date, payment_method, reference_number, construction_site, notes')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .limit(10);

    if (paymentsError) {
      console.error('Balance API: Payments query error:', paymentsError);
    }

    // Fetch balance adjustments - RLS will filter automatically
    const { data: adjustments, error: adjustmentsError } = await supabase
      .rpc('get_client_balance_adjustments', { p_client_id: clientId })
      .limit(10);

    if (adjustmentsError) {
      console.error('Balance API: Adjustments query error:', adjustmentsError);
    }

    // Get orders with construction site information
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, final_amount, construction_site')
      .eq('client_id', clientId);

    if (ordersError) {
      console.error('Balance API: Orders query error:', ordersError);
    }

    const orderIds = orders?.map(o => o.id) || [];
    
    console.log('Balance API: Fetching order items for', orderIds.length, 'orders');
    
    // Get order items to calculate volumes (with error handling for fetch failures)
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
        
        console.log(`Balance API: Processing ${batches.length} batches of order IDs`);
        
        for (let i = 0; i < batches.length; i++) {
          const batchIds = batches[i];
          
          try {
            const { data: itemsData, error: itemsError } = await supabase
              .from('order_items')
              .select('order_id, volume')
              .in('order_id', batchIds);

            if (itemsError) {
              console.error(`Balance API: Order items query error for batch ${i + 1}:`, {
                message: itemsError.message,
                details: itemsError.details,
                hint: itemsError.hint,
                code: itemsError.code
              });
            } else {
              orderItems.push(...(itemsData || []));
              console.log(`Balance API: Batch ${i + 1}/${batches.length} fetched ${itemsData?.length || 0} items`);
            }
          } catch (batchError) {
            console.error(`Balance API: Batch ${i + 1} fetch failed:`, batchError instanceof Error ? batchError.message : String(batchError));
          }
        }
        
        console.log(`Balance API: Total order items fetched: ${orderItems.length}`);
      } catch (error) {
        console.error('Balance API: Order items query error:', {
          message: error instanceof Error ? error.message : String(error),
          details: error instanceof Error ? error.stack : '',
        });
      }
    }

    // Calculate volumes and monetary amounts per construction site
    const siteVolumes: Record<string, number> = {};
    const siteMonetaryAmounts: Record<string, number> = {};
    
    console.log('Balance API: Processing', orderItems.length, 'order items from', orders?.length, 'orders');
    
    // Aggregate volumes from order_items by construction site
    orderItems.forEach((item: any) => {
      const order = orders?.find(o => o.id === item.order_id);
      if (order && order.construction_site) {
        const site = order.construction_site;
        const volume = parseFloat(item.volume) || 0;
        siteVolumes[site] = (siteVolumes[site] || 0) + volume;
        console.log(`Balance API: Added ${volume} m³ to site "${site}". New total: ${siteVolumes[site]}`);
      }
    });

    console.log('Balance API: Site volumes calculated:', siteVolumes);

    // Calculate monetary amounts per site from orders that have items
    const ordersWithItems = new Set(orderItems.map((item: any) => item.order_id));
    orders?.forEach(order => {
      if (ordersWithItems.has(order.id) && order.construction_site) {
        const site = order.construction_site;
        siteMonetaryAmounts[site] = (siteMonetaryAmounts[site] || 0) + (parseFloat(order.final_amount as any) || 0);
      }
    });

    console.log('Balance API: Site monetary amounts calculated:', siteMonetaryAmounts);

    // Calculate totals
    const totalDeliveredVolume = orderItems.reduce((sum, item) => sum + (parseFloat(item.volume) || 0), 0);
    const totalPaid = payments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
    const totalConsumption = orders
      ?.filter(o => ordersWithItems.has(o.id))
      .reduce((sum, o) => sum + (parseFloat(o.final_amount as any) || 0), 0) || 0;

    console.log('Balance API: Site balances from DB:', siteBalances.map(b => b.construction_site));

    // Format site balances with volumes and monetary amounts
    const sitesWithVolume = siteBalances.map(balance => {
      const siteName = balance.construction_site || 'Obra Desconocida';
      const volume = siteVolumes[balance.construction_site || ''] || 0;
      const monetaryAmount = siteMonetaryAmounts[balance.construction_site || ''] || 0;
      
      console.log(`Balance API: Mapping balance for site "${siteName}": volume=${volume}, amount=${monetaryAmount}`);
      
      return {
        site_name: siteName,
        balance: parseFloat(balance.current_balance) || 0,
        volume: volume,
        monetary_amount: monetaryAmount
      };
    });

    const responseData = {
      general: {
        current_balance: parseFloat(generalBalance?.current_balance as any) || 0,
        total_delivered: totalConsumption,
        total_paid: totalPaid,
        total_volume: totalDeliveredVolume
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

    console.log('Balance API: Returning data:', responseData);
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Balance API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

