import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Build the base query - RLS will automatically filter by client_id
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        order_status,
        elemento,
        created_at
      `)
      .order('delivery_date', { ascending: false });

    // Apply status filter if provided
    if (statusFilter && statusFilter !== 'all') {
      ordersQuery = ordersQuery.eq('order_status', statusFilter);
    }

    // Apply search filter if provided
    if (searchQuery) {
      ordersQuery = ordersQuery.or(
        `order_number.ilike.%${searchQuery}%,construction_site.ilike.%${searchQuery}%`
      );
    }

    // Apply date range filter if provided
    if (fromDate) {
      ordersQuery = ordersQuery.gte('delivery_date', fromDate);
    }
    if (toDate) {
      ordersQuery = ordersQuery.lte('delivery_date', toDate);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      totalCount: orders?.length || 0
    });

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
