import {
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** Matches OrdersList / orderService classification for m³ reporting */
function isEmptyTruckChargeItem(item: {
  product_type?: string | null;
  has_empty_truck_charge?: boolean | null;
}): boolean {
  const productType = (item.product_type || '').toString();
  return (
    !!item.has_empty_truck_charge ||
    productType === 'VACÍO DE OLLA' ||
    productType === 'EMPTY_TRUCK_CHARGE'
  );
}

function isPumpServiceItem(item: { product_type?: string | null }): boolean {
  const productType = (item.product_type || '').toString();
  return (
    productType === 'SERVICIO DE BOMBEO' ||
    productType.toLowerCase().includes('bombeo') ||
    productType.toLowerCase().includes('pump')
  );
}

function concreteVolumeM3ForItem(item: Record<string, unknown>): number {
  if (isEmptyTruckChargeItem(item) || isPumpServiceItem(item)) return 0;
  const delivered = Number(item.concrete_volume_delivered) || 0;
  if (delivered > 0) return delivered;
  return Number(item.volume) || 0;
}

function pumpVolumeM3ForItem(item: Record<string, unknown>): number {
  const delivered = Number(item.pump_volume_delivered) || 0;
  if (delivered > 0) return delivered;
  if (item.has_pump_service || isPumpServiceItem(item)) {
    const pv = Number(item.pump_volume) || 0;
    if (pv > 0) return pv;
    if (isPumpServiceItem(item)) return Number(item.volume) || 0;
  }
  return 0;
}

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const association = resolved.ctx;

    const isExecutive = association.roleWithinClient === 'executive';
    const hasViewPricesPermission = isExecutive || association.permissions?.view_prices === true;

    if (!hasViewPricesPermission) {
      return NextResponse.json(
        { error: 'No tienes permiso para acceder a información financiera. Contacta al administrador de tu organización.' },
        { status: 403 }
      );
    }

    const clientId = association.clientId;

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
              .select(
                'order_id, volume, product_type, has_pump_service, has_empty_truck_charge, pump_volume, pump_volume_delivered, concrete_volume_delivered'
              )
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
    const siteConcreteVolumes: Record<string, number> = {};
    const sitePumpVolumes: Record<string, number> = {};
    const siteMonetaryAmounts: Record<string, number> = {};

    orderItems.forEach((item: any) => {
      const order = orders?.find(o => o.id === item.order_id);
      if (order && order.construction_site) {
        const site = order.construction_site;
        siteConcreteVolumes[site] =
          (siteConcreteVolumes[site] || 0) + concreteVolumeM3ForItem(item);
        sitePumpVolumes[site] = (sitePumpVolumes[site] || 0) + pumpVolumeM3ForItem(item);
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

    // Calculate totals for selected date range (concrete + pumping m³)
    const totalDeliveredVolume = orderItems.reduce(
      (sum, item) => sum + concreteVolumeM3ForItem(item) + pumpVolumeM3ForItem(item),
      0
    );
    const totalPaid = paymentsInRange?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
    const totalConsumption = orders
      ?.filter(o => ordersWithItems.has(o.id))
      .reduce((sum, o) => sum + (parseFloat(o.final_amount as any) || 0), 0) || 0;

    // Format site balances with volumes and monetary amounts
    const sitesWithVolume = siteBalances.map(balance => {
      const siteKey = balance.construction_site || '';
      const volumeConcrete = siteConcreteVolumes[siteKey] || 0;
      const volumePumping = sitePumpVolumes[siteKey] || 0;
      return {
        site_name: balance.construction_site || 'Obra Desconocida',
        balance: parseFloat(balance.current_balance) || 0,
        volume: volumeConcrete + volumePumping,
        volume_concrete: volumeConcrete,
        volume_pumping: volumePumping,
        monetary_amount: siteMonetaryAmounts[siteKey] || 0
      };
    });

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

