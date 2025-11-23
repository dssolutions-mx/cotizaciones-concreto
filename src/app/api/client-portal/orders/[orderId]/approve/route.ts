import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/client-portal/orders/[orderId]/approve
 * Approves an order that was pending client approval
 * Only accessible by executive users
 * This moves the order to credit validation stage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orderId = params.orderId;

    // Get the order to verify it exists and needs approval
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        client_id,
        created_by,
        client_approval_status,
        clients!inner (
          id,
          business_name,
          requires_internal_approval
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check if order is actually pending approval
    if (order.client_approval_status !== 'pending_client') {
      return NextResponse.json(
        {
          error: 'Order is not pending approval',
          current_status: order.client_approval_status,
        },
        { status: 400 }
      );
    }

    // Check if current user is an executive for this client
    const { data: userAssociation, error: assocError } = await supabase
      .from('client_portal_users')
      .select('id, role_within_client')
      .eq('user_id', user.id)
      .eq('client_id', order.client_id)
      .eq('role_within_client', 'executive')
      .eq('is_active', true)
      .maybeSingle();

    if (assocError || !userAssociation) {
      return NextResponse.json(
        { error: 'Access denied. Only executive users can approve orders.' },
        { status: 403 }
      );
    }

    // Prevent executives from approving their own orders (business rule)
    if (order.created_by === user.id) {
      return NextResponse.json(
        { error: 'You cannot approve your own order. Ask another executive to approve it.' },
        { status: 400 }
      );
    }

    // Update the order to approved status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        client_approval_status: 'approved_by_client',
        client_approved_by: user.id,
        client_approval_date: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select(`
        id,
        order_number,
        client_approval_status,
        client_approved_by,
        client_approval_date
      `)
      .single();

    if (updateError) {
      console.error('Error approving order:', updateError);
      return NextResponse.json(
        { error: 'Failed to approve order' },
        { status: 500 }
      );
    }

    // Insert approval history record (if table exists)
    await supabase
      .from('order_approval_history')
      .insert({
        order_id: orderId,
        actioned_by: user.id,
        action: 'approved',
        approval_stage: 'client_internal',
        notes: 'Order approved by client executive',
      })
      .then(() => {})
      .catch((err) => {
        console.warn('Could not insert approval history (table may not exist):', err);
      });

    // The database trigger will automatically send webhook notification
    // to credit validators when client_approval_status changes to 'approved_by_client'

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Order approved successfully. It will now proceed to credit validation.',
    });
  } catch (error) {
    console.error('Order approval API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
