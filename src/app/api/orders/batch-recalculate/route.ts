import { NextRequest, NextResponse } from 'next/server';
import {
  createServerSupabaseClientFromRequest,
  createServiceClient,
} from '@/lib/supabase/server';
import { recalculateOrderAmount } from '@/services/orderService';

const UNAUTHORIZED_HEADERS = { 'Cache-Control': 'no-store' as const };
const REMISION_ORDER_CHUNK = 400;

/**
 * POST /api/orders/batch-recalculate
 * Body: { client_id?: string | null }
 * Recalculates final_amount / invoice_amount for non-cancelled orders
 * that have remisiones or effective_for_balance, then refreshes client_balances
 * per affected construction site and the NULL (aggregate) row.
 */
export async function POST(request: NextRequest) {
  try {
    const authClient = createServerSupabaseClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: UNAUTHORIZED_HEADERS }
      );
    }

    let body: { client_id?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      /* empty body */
    }
    const clientIdFilter =
      body.client_id === undefined || body.client_id === null || body.client_id === ''
        ? undefined
        : body.client_id;

    const admin = createServiceClient();

    let ordersQuery = admin
      .from('orders')
      .select('id, client_id, construction_site, construction_site_id, effective_for_balance')
      .not('order_status', 'eq', 'cancelled');

    if (clientIdFilter) {
      ordersQuery = ordersQuery.eq('client_id', clientIdFilter);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) {
      return NextResponse.json(
        { error: ordersError.message },
        { status: 500, headers: UNAUTHORIZED_HEADERS }
      );
    }

    const list = orders ?? [];
    const orderIds = list.map((o) => o.id);
    const withRemision = new Set<string>();
    for (let i = 0; i < orderIds.length; i += REMISION_ORDER_CHUNK) {
      const slice = orderIds.slice(i, i + REMISION_ORDER_CHUNK);
      const { data: remRows, error: remErr } = await admin
        .from('remisiones')
        .select('order_id')
        .in('order_id', slice);
      if (remErr) {
        return NextResponse.json(
          { error: remErr.message },
          { status: 500, headers: UNAUTHORIZED_HEADERS }
        );
      }
      remRows?.forEach((r) => withRemision.add(r.order_id));
    }

    const toRecalc = list.filter(
      (o) => o.effective_for_balance === true || withRemision.has(o.id)
    );

    const { error: bulkOnError } = await admin.rpc('set_arkik_bulk_mode', {
      enabled: true,
    } as never);
    if (bulkOnError) {
      return NextResponse.json(
        { error: `set_arkik_bulk_mode: ${bulkOnError.message}` },
        { status: 500, headers: UNAUTHORIZED_HEADERS }
      );
    }

    const recalcErrors: Array<{ orderId: string; message: string }> = [];
    try {
      for (const o of toRecalc) {
        try {
          await recalculateOrderAmount(o.id, admin);
        } catch (e) {
          recalcErrors.push({
            orderId: o.id,
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    } finally {
      await admin.rpc('set_arkik_bulk_mode', { enabled: false } as never);
    }

    const clientIds = Array.from(
      new Set(
        toRecalc.map((o) => o.client_id).filter((id): id is string => Boolean(id))
      )
    );

    const balanceErrors: Array<{ clientId: string; message: string }> = [];
    for (const cid of clientIds) {
      const siteKeys = new Map<
        string,
        { siteName: string | null; siteId: string | null }
      >();
      for (const o of toRecalc) {
        if (o.client_id !== cid) continue;
        const sid = (o as { construction_site_id?: string | null }).construction_site_id;
        const sn = o.construction_site;
        if (sid) {
          siteKeys.set(`id:${sid}`, { siteName: typeof sn === 'string' ? sn : null, siteId: sid });
        } else if (typeof sn === 'string' && sn.trim().length > 0) {
          siteKeys.set(`name:${sn}`, { siteName: sn, siteId: null });
        }
      }

      for (const s of siteKeys.values()) {
        const { error } = s.siteId
          ? await admin.rpc(
              'update_client_balance_with_uuid',
              {
                p_client_id: cid,
                p_site_id: s.siteId,
                p_site_name: s.siteName,
              } as never
            )
          : await admin.rpc(
              'update_client_balance',
              { p_client_id: cid, p_site_name: s.siteName } as never
            );
        if (error) {
          balanceErrors.push({
            clientId: cid,
            message: `site "${s.siteName ?? s.siteId}": ${error.message}`,
          });
        }
      }

      const { error: nullErr } = await admin.rpc(
        'update_client_balance',
        { p_client_id: cid, p_site_name: null } as never
      );
      if (nullErr) {
        balanceErrors.push({
          clientId: cid,
          message: `aggregate (null site): ${nullErr.message}`,
        });
      }
    }

    return NextResponse.json(
      {
        ordersConsidered: list.length,
        ordersRecalculated: toRecalc.length,
        recalcErrors,
        clientsBalanceRefreshed: clientIds.length,
        balanceErrors,
      },
      { headers: UNAUTHORIZED_HEADERS }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: UNAUTHORIZED_HEADERS }
    );
  }
}
