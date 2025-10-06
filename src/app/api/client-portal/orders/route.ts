import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: clientData, error: clientError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (clientError || !clientData) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    if (clientData.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json({ error: 'Access denied. This endpoint is for external clients only.' }, { status: 403 });
    }

    const clientId = user.id;

    // Build the base query for orders
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        order_status,
        total_volume,
        created_at,
        client_id
      `)
      .eq('client_id', clientId)
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

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error('Error fetching orders:', ordersError);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Calculate total volume for each order from order_items if needed
    const ordersWithVolume = await Promise.all(
      (orders || []).map(async (order) => {
        if (order.total_volume) {
          return order;
        }

        // Get total volume from order_items if not already calculated
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('volume')
          .eq('order_id', order.id);

        const totalVolume = orderItems?.reduce((sum, item) => sum + (item.volume || 0), 0) || 0;

        return {
          ...order,
          total_volume: totalVolume
        };
      })
    );

    return NextResponse.json({
      orders: ordersWithVolume,
      totalCount: ordersWithVolume.length
    });

  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
