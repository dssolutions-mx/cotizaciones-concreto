import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for rejection
const rejectOrderSchema = z.object({
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

/**
 * POST /api/client-portal/orders/[orderId]/reject
 * Rejects an order that was pending client approval
 * Only accessible by executive users
 * Requires a rejection reason
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId } = await params;

    // Parse and validate request body
    const body = await request.json();
    const validation = rejectOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { reason } = validation.data;

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
          business_name
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
        { error: 'Access denied. Only executive users can reject orders.' },
        { status: 403 }
      );
    }

    // Update the order to rejected status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        client_approval_status: 'rejected_by_client',
        client_approved_by: user.id, // Store who rejected it
        client_approval_date: new Date().toISOString(),
        client_rejection_reason: reason,
      })
      .eq('id', orderId)
      .select(`
        id,
        order_number,
        client_approval_status,
        client_approved_by,
        client_approval_date,
        client_rejection_reason
      `)
      .single();

    if (updateError) {
      console.error('Error rejecting order:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject order' },
        { status: 500 }
      );
    }

    // Insert approval history record (if table exists)
    await supabase
      .from('order_approval_history')
      .insert({
        order_id: orderId,
        actioned_by: user.id,
        action: 'rejected',
        approval_stage: 'client_internal',
        rejection_reason: reason,
        notes: `Order rejected by client executive: ${reason}`,
      })
      .then(() => {})
      .catch((err) => {
        console.warn('Could not insert approval history (table may not exist):', err);
      });

    // The database trigger will send notification to the order creator

    return NextResponse.json({
      success: true,
      data: updatedOrder,
      message: 'Order rejected successfully. The creator has been notified.',
    });
  } catch (error) {
    console.error('Order rejection API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
