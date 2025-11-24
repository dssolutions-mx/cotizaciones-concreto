import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/client-portal/orders/pending-approval
 * Gets all orders pending client approval for the current executive user
 * Only accessible by executive users
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'EXTERNAL_CLIENT') {
      return NextResponse.json(
        { error: 'Access denied. Only client portal users can access this endpoint.' },
        { status: 403 }
      );
    }

    // Check if user is an executive for any client
    const { data: clientAssociations, error: clientsError } = await supabase
      .from('client_portal_users')
      .select('client_id, role_within_client')
      .eq('user_id', user.id)
      .eq('role_within_client', 'executive')
      .eq('is_active', true);

    if (clientsError || !clientAssociations || clientAssociations.length === 0) {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can view pending approvals.' },
        { status: 403 }
      );
    }

    // Get all client IDs where user is executive
    const clientIds = clientAssociations.map(assoc => assoc.client_id);

    // Get all orders pending approval for these clients
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        client_id,
        created_by,
        delivery_date,
        delivery_time,
        preliminary_amount,
        invoice_amount,
        special_requirements,
        client_approval_status,
        created_at,
        clients!inner (
          id,
          business_name,
          client_code
        ),
        user_profiles!orders_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        ),
        order_items (
          id,
          product_id,
          concrete_volume_requested,
          products (
            id,
            product_name,
            product_code
          )
        )
      `)
      .in('client_id', clientIds)
      .eq('client_approval_status', 'pending_client')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('Error fetching pending orders:', ordersError);
      return NextResponse.json(
        { error: 'Failed to fetch pending orders' },
        { status: 500 }
      );
    }

    // Transform the data to a cleaner format
    const formattedOrders = pendingOrders?.map((order) => {
      const creator = order.user_profiles as any;
      const client = order.clients as any;
      const items = order.order_items as any[];

      // Calculate total volume
      const totalVolume = items?.reduce(
        (sum, item) => sum + (parseFloat(item.concrete_volume_requested) || 0),
        0
      ) || 0;

      // Get product summary
      const productSummary = items?.map(item => ({
        product_name: item.products?.product_name || 'Unknown Product',
        volume: parseFloat(item.concrete_volume_requested) || 0,
      })) || [];

      return {
        id: order.id,
        order_number: order.order_number,
        client_id: order.client_id,
        client_name: client?.business_name || '',
        client_code: client?.client_code || '',
        created_by_id: order.created_by,
        created_by_name: creator ? `${creator.first_name} ${creator.last_name}`.trim() : 'Unknown',
        created_by_email: creator?.email || '',
        delivery_date: order.delivery_date,
        delivery_time: order.delivery_time,
        preliminary_amount: order.preliminary_amount,
        invoice_amount: order.invoice_amount,
        special_requirements: order.special_requirements,
        total_volume: totalVolume,
        product_summary: productSummary,
        created_at: order.created_at,
      };
    }) || [];

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      count: formattedOrders.length,
    });
  } catch (error) {
    console.error('Pending approval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
