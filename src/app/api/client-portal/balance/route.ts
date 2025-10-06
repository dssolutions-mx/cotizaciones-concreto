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

    // Get orders to calculate delivered volume and amounts per site
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, final_amount, construction_site')
      .eq('client_id', clientId);

    if (ordersError) {
      console.error('Balance API: Orders query error:', ordersError);
    }

    const orderIds = orders?.map(o => o.id) || [];
    
    // Get remisiones for delivered volume by site
    let remisiones: any[] = [];
    if (orderIds.length > 0) {
      const { data: remisionesData, error: remisionesError } = await supabase
        .from('remisiones')
        .select('order_id, volumen_fabricado, tipo_remision')
        .neq('tipo_remision', 'BOMBEO')
        .in('order_id', orderIds);

      if (remisionesError) {
        console.error('Balance API: Remisiones query error:', remisionesError);
      } else {
        remisiones = remisionesData || [];
      }
    }

    // Map remisiones to construction sites via orders, track volumes AND monetary amounts
    const siteVolumes: Record<string, number> = {};
    const siteMonetaryAmounts: Record<string, number> = {};
    const ordersWithRemisiones = new Set<string>();
    
    remisiones.forEach((rem: any) => {
      const order = orders?.find(o => o.id === rem.order_id);
      if (order && order.construction_site) {
        const site = order.construction_site;
        siteVolumes[site] = (siteVolumes[site] || 0) + (parseFloat(rem.volumen_fabricado) || 0);
        ordersWithRemisiones.add(rem.order_id);
      }
    });

    // Calculate monetary amounts per site (from orders that have remisiones)
    orders?.forEach(order => {
      if (ordersWithRemisiones.has(order.id) && order.construction_site) {
        const site = order.construction_site;
        siteMonetaryAmounts[site] = (siteMonetaryAmounts[site] || 0) + (parseFloat(order.final_amount as any) || 0);
      }
    });

    // Calculate total delivered volume and monetary amount
    const totalDeliveredVolume = remisiones.reduce((sum, r) => sum + (parseFloat(r.volumen_fabricado) || 0), 0);
    const totalPaid = payments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
    
    // Calculate total consumption (sum of all delivered orders' amounts)
    const totalConsumption = orders
      ?.filter(o => ordersWithRemisiones.has(o.id))
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

