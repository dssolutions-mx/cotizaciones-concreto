import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromBody,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { createPortalOrder } from '@/lib/client-portal/portalOrderCreation';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const searchQuery = searchParams.get('search');
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientIdParam = getOptionalPortalClientIdFromRequest(request);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }

    let ordersQuery = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        construction_site,
        delivery_date,
        order_status,
        credit_status,
        client_approval_status,
        elemento,
        created_at
      `)
      .eq('client_id', resolved.ctx.clientId)
      .order('delivery_date', { ascending: false });

    // Apply status filter if provided
    // Handle combined status filtering for client portal view
    if (statusFilter && statusFilter !== 'all') {
      switch (statusFilter) {
        case 'pending_approval':
          // Orders waiting for client executive approval
          ordersQuery = ordersQuery.eq('client_approval_status', 'pending_client');
          break;
        case 'pending_credit':
          // Orders approved by client but waiting for credit validation
          ordersQuery = ordersQuery
            .in('client_approval_status', ['approved_by_client', 'not_required'])
            .eq('credit_status', 'pending');
          break;
        case 'approved':
          // Fully approved orders
          ordersQuery = ordersQuery.eq('credit_status', 'approved');
          break;
        case 'in_progress':
          // Orders being delivered
          ordersQuery = ordersQuery.eq('order_status', 'in_progress');
          break;
        case 'completed':
          // Completed orders
          ordersQuery = ordersQuery.eq('order_status', 'completed');
          break;
        default:
          // For any other status, filter by order_status
          ordersQuery = ordersQuery.eq('order_status', statusFilter);
      }
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

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const clientIdParam =
      getOptionalPortalClientIdFromRequest(request) || getOptionalPortalClientIdFromBody(body);
    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: resolved.status });
    }
    const association = resolved.ctx;

    const isExecutive = association.roleWithinClient === 'executive';
    const hasCreatePermission =
      isExecutive || association.permissions?.create_orders === true;

    if (!hasCreatePermission) {
      return NextResponse.json(
        { error: 'No tienes permiso para crear pedidos. Contacta al administrador de tu organización.' },
        { status: 403 }
      );
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', association.clientId)
      .single();

    if (clientError || !client) {
      console.error('Client not found in clients table:', association.clientId, clientError);
      return NextResponse.json(
        { error: 'El cliente asociado no existe. Contacta al administrador.' },
        { status: 404 }
      );
    }

    const result = await createPortalOrder(
      supabase,
      user.id,
      user.email,
      association,
      body
    );

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (error) {
    console.error('Orders API POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
