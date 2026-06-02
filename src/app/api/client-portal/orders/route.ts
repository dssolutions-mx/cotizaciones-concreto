import { createServerSupabaseClientFromRequest } from '@/lib/supabase/server';
import {
  getOptionalPortalClientIdFromBody,
  getOptionalPortalClientIdFromRequest,
  resolvePortalContext,
} from '@/lib/client-portal/resolvePortalContext';
import { createPortalOrder } from '@/lib/client-portal/portalOrderCreation';
import {
  createPortalOrderReference,
  logPortalOrderError,
  normalizeUnknownError,
  portalOrderSupportLine,
  PORTAL_ORDER_LOG_SCOPE,
} from '@/lib/client-portal/portalOrderDiagnostics';
import { NextResponse } from 'next/server';

function portalOrderErrorResponse(
  status: number,
  userMessage: string,
  reference: string,
  code: string
) {
  return NextResponse.json(
    { error: userMessage, reference, code, support_hint: portalOrderSupportLine(reference) },
    { status, headers: { 'X-Portal-Order-Reference': reference } }
  );
}

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

    if (statusFilter && statusFilter !== 'all') {
      switch (statusFilter) {
        case 'pending_approval':
          ordersQuery = ordersQuery.eq('client_approval_status', 'pending_client');
          break;
        case 'pending_credit':
          ordersQuery = ordersQuery
            .in('client_approval_status', ['approved_by_client', 'not_required'])
            .eq('credit_status', 'pending');
          break;
        case 'approved':
          ordersQuery = ordersQuery.eq('credit_status', 'approved');
          break;
        case 'in_progress':
          ordersQuery = ordersQuery.eq('order_status', 'in_progress');
          break;
        case 'completed':
          ordersQuery = ordersQuery.eq('order_status', 'completed');
          break;
        default:
          ordersQuery = ordersQuery.eq('order_status', statusFilter);
      }
    }

    if (searchQuery) {
      ordersQuery = ordersQuery.or(
        `order_number.ilike.%${searchQuery}%,construction_site.ilike.%${searchQuery}%`
      );
    }

    if (fromDate) {
      ordersQuery = ordersQuery.gte('delivery_date', fromDate);
    }
    if (toDate) {
      ordersQuery = ordersQuery.lte('delivery_date', toDate);
    }

    const { data: orders, error: ordersError } = await ordersQuery;

    if (ordersError) {
      console.error(
        JSON.stringify({
          scope: PORTAL_ORDER_LOG_SCOPE,
          event: 'list_failed',
          error: normalizeUnknownError(ordersError),
        })
      );
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
      orders: orders || [],
      totalCount: orders?.length || 0,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: PORTAL_ORDER_LOG_SCOPE,
        event: 'list_unexpected',
        error: normalizeUnknownError(error),
      })
    );
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const reference = createPortalOrderReference();

  try {
    const supabase = createServerSupabaseClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      logPortalOrderError(
        'auth_failed',
        { reference, step: 'auth', userId: user?.id },
        authError ?? new Error('no user')
      );
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseErr) {
      logPortalOrderError(
        'body_parse_failed',
        { reference, step: 'parse_body', userId: user.id },
        parseErr
      );
      return portalOrderErrorResponse(
        400,
        'La solicitud no tiene un formato válido.',
        reference,
        'UNEXPECTED'
      );
    }

    const clientIdParam =
      getOptionalPortalClientIdFromRequest(request) ||
      getOptionalPortalClientIdFromBody(body);

    const resolved = await resolvePortalContext(supabase, user.id, clientIdParam);
    if (!resolved.ok) {
      logPortalOrderWarnRoute(reference, 'resolve_context_failed', user.id, {
        status: resolved.status,
        message: resolved.message,
      });
      return portalOrderErrorResponse(
        resolved.status,
        resolved.message,
        reference,
        'UNEXPECTED'
      );
    }

    const association = resolved.ctx;

    const isExecutive = association.roleWithinClient === 'executive';
    const hasCreatePermission =
      isExecutive || association.permissions?.create_orders === true;

    if (!hasCreatePermission) {
      return portalOrderErrorResponse(
        403,
        'No tienes permiso para crear pedidos. Contacta al administrador de tu organización.',
        reference,
        'UNEXPECTED'
      );
    }

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', association.clientId)
      .single();

    if (clientError || !client) {
      logPortalOrderError(
        'client_not_found',
        {
          reference,
          step: 'load_client',
          userId: user.id,
          clientId: association.clientId,
        },
        clientError ?? new Error('client missing')
      );
      return portalOrderErrorResponse(
        404,
        'El cliente asociado no existe. Contacta al administrador.',
        reference,
        'UNEXPECTED'
      );
    }

    const result = await createPortalOrder(
      supabase,
      user.id,
      user.email,
      association,
      body as Parameters<typeof createPortalOrder>[4]
    );

    if ('error' in result) {
      return NextResponse.json(
        {
          error: result.error,
          reference: result.reference,
          code: result.code,
          support_hint: portalOrderSupportLine(result.reference),
        },
        {
          status: result.status,
          headers: { 'X-Portal-Order-Reference': result.reference },
        }
      );
    }

    return NextResponse.json(
      { id: result.id, reference: result.reference },
      {
        status: 201,
        headers: { 'X-Portal-Order-Reference': result.reference },
      }
    );
  } catch (error) {
    logPortalOrderError(
      'route_unexpected',
      { reference, step: 'route_catch' },
      error
    );
    return portalOrderErrorResponse(
      500,
      'Error interno al procesar el pedido.',
      reference,
      'UNEXPECTED'
    );
  }
}

function logPortalOrderWarnRoute(
  reference: string,
  event: string,
  userId: string,
  extra: Record<string, unknown>
) {
  console.warn(
    JSON.stringify({
      scope: PORTAL_ORDER_LOG_SCOPE,
      level: 'warn',
      event,
      reference,
      userId,
      ...extra,
    })
  );
}
