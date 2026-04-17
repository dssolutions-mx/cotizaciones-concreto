import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const READ_ROLES = new Set([
  'EXECUTIVE',
  'ADMIN_OPERATIONS',
  'CREDIT_VALIDATOR',
  'ADMINISTRATIVE',
  'PLANT_MANAGER',
  'SALES_AGENT',
]);

/** Max orders to evaluate for missing_only / total (safety cap for date ranges that are too wide). */
const MAX_ORDERS_EVALUATE = 20000;

const ORDER_STATUSES = [
  'created',
  'validated',
  'scheduled',
  'CREATED',
  'VALIDATED',
  'SCHEDULED',
];

function parseYmd(s: string | null): string | null {
  if (!s) return null;
  const m = /^([0-9]{4}-[0-9]{2}-[0-9]{2})/.exec(s);
  return m ? m[1] : null;
}

type OrderConcreteEvidenceRow = {
  order_id: string;
  id: string;
  created_at: string;
  updated_at: string;
  original_name: string;
  uploaded_by: string | null;
  file_path: string;
};

function pickLatestEvidence(files: OrderConcreteEvidenceRow[]): OrderConcreteEvidenceRow | null {
  if (files.length === 0) return null;
  return files.reduce((best, cur) => {
    const bt = new Date(best.updated_at || best.created_at).getTime();
    const ct = new Date(cur.updated_at || cur.created_at).getTime();
    return ct >= bt ? cur : best;
  });
}

function effectivePlantIdForFinanzas(
  profile: { role: string; plant_id: string | null },
  plantIdParam: string | null
): string | null {
  if (profile.role === 'PLANT_MANAGER' && profile.plant_id) {
    return profile.plant_id;
  }
  return plantIdParam?.trim() || null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function countConcreteRemisionesByOrder(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orderIds: string[]
): Promise<Map<string, number>> {
  const countByOrder = new Map<string, number>();
  for (const part of chunk(orderIds, 400)) {
    const { data, error } = await supabase
      .from('remisiones')
      .select('order_id')
      .in('order_id', part)
      .eq('tipo_remision', 'CONCRETO');
    if (error) throw error;
    for (const r of data || []) {
      const oid = (r as { order_id: string }).order_id;
      countByOrder.set(oid, (countByOrder.get(oid) || 0) + 1);
    }
  }
  return countByOrder;
}

async function orderIdsWithEvidence(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orderIds: string[]
): Promise<Set<string>> {
  const set = new Set<string>();
  for (const part of chunk(orderIds, 400)) {
    const { data, error } = await supabase
      .from('order_concrete_evidence')
      .select('order_id')
      .in('order_id', part);
    if (error) throw error;
    for (const r of data || []) {
      set.add((r as { order_id: string }).order_id);
    }
  }
  return set;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role, plant_id, first_name, last_name')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !READ_ROLES.has(profile.role)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const plantIdParam = searchParams.get('plant_id');
    const clientId = searchParams.get('client_id');
    const missingOnly = searchParams.get('missing_only') === '1' || searchParams.get('missing_only') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '80', 10) || 80, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const fromYmd = parseYmd(dateFrom) || dateFrom;
    const toYmd = parseYmd(dateTo) || dateTo;

    const effectivePlantId = effectivePlantIdForFinanzas(profile, plantIdParam);

    const buildBaseOrdersQuery = () => {
      let q = supabase.from('orders').select(
        `
        id,
        order_number,
        delivery_date,
        construction_site,
        plant_id,
        client_id,
        clients:clients ( business_name ),
        plant:plants!plant_id ( id, code, name )
      `
      );

      if (fromYmd) q = q.gte('delivery_date', fromYmd);
      if (toYmd) q = q.lte('delivery_date', toYmd);
      if (effectivePlantId) q = q.eq('plant_id', effectivePlantId);
      if (clientId) q = q.eq('client_id', clientId);
      q = q.in('order_status', ORDER_STATUSES);
      return q;
    };

    if (missingOnly) {
      const { data: orderRows, error: ordErr } = await buildBaseOrdersQuery()
        .order('delivery_date', { ascending: false })
        .limit(MAX_ORDERS_EVALUATE);

      if (ordErr) {
        console.error('finanzas concrete-evidence orders (missing):', ordErr);
        return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
      }

      const ordered = (orderRows || []) as any[];
      const allIds = ordered.map((o) => o.id as string);
      if (allIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: { rows: [], total: 0, truncated: false },
        });
      }

      let countByOrder: Map<string, number>;
      let evidenceOrders: Set<string>;
      try {
        countByOrder = await countConcreteRemisionesByOrder(supabase, allIds);
        evidenceOrders = await orderIdsWithEvidence(supabase, allIds);
      } catch (e) {
        console.error('finanzas concrete-evidence missing batch:', e);
        return NextResponse.json({ error: 'Error al evaluar remisiones/evidencia' }, { status: 500 });
      }

      const missingOrdered: typeof ordered = [];
      for (const o of ordered) {
        const c = countByOrder.get(o.id) || 0;
        if (c > 0 && !evidenceOrders.has(o.id)) missingOrdered.push(o);
      }

      const total = missingOrdered.length;
      const truncated = ordered.length >= MAX_ORDERS_EVALUATE;
      const pageOrders = missingOrdered.slice(offset, offset + limit);
      const pageIds = pageOrders.map((o) => o.id);

      if (pageIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: { rows: [], total, truncated },
        });
      }

      const { data: evidenceRows, error: evErr } = await supabase
        .from('order_concrete_evidence')
        .select('order_id, id, created_at, updated_at, original_name, uploaded_by, file_path')
        .in('order_id', pageIds)
        .order('created_at', { ascending: true });

      if (evErr) {
        console.error('finanzas concrete-evidence evidence:', evErr);
        return NextResponse.json({ error: 'Error al cargar evidencia' }, { status: 500 });
      }

      const evidenceByOrder = new Map<string, OrderConcreteEvidenceRow[]>();
      for (const e of (evidenceRows || []) as OrderConcreteEvidenceRow[]) {
        const list = evidenceByOrder.get(e.order_id) || [];
        list.push(e);
        evidenceByOrder.set(e.order_id, list);
      }

      const { data: remisionesCounts, error: cErr } = await supabase
        .from('remisiones')
        .select('order_id')
        .in('order_id', pageIds)
        .eq('tipo_remision', 'CONCRETO');

      if (cErr) {
        console.error('finanzas concrete-evidence remisiones:', cErr);
        return NextResponse.json({ error: 'Error al contar remisiones' }, { status: 500 });
      }

      const remCountPage = new Map<string, number>();
      for (const r of remisionesCounts || []) {
        const oid = (r as { order_id: string }).order_id;
        remCountPage.set(oid, (remCountPage.get(oid) || 0) + 1);
      }

      const uploaderIds = Array.from(
        new Set(
          ((evidenceRows || []) as OrderConcreteEvidenceRow[])
            .map((e) => e.uploaded_by)
            .filter((id): id is string => Boolean(id))
        )
      );
      const uploaderNames: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: ups } = await supabase
          .from('user_profiles')
          .select('id, first_name, last_name')
          .in('id', uploaderIds);
        for (const u of ups || []) {
          uploaderNames[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.id;
        }
      }

      const rows = pageOrders.map((o: any) => {
        const fileRows = evidenceByOrder.get(o.id) || [];
        const concreteCount = remCountPage.get(o.id) || 0;
        const clientName =
          o.clients && typeof o.clients === 'object' && !Array.isArray(o.clients)
            ? (o.clients as { business_name?: string }).business_name
            : Array.isArray(o.clients)
              ? (o.clients[0] as { business_name?: string })?.business_name
              : null;

        const plantObj = o.plant;
        const plantFlat =
          plantObj && typeof plantObj === 'object' && !Array.isArray(plantObj)
            ? (plantObj as { code?: string; name?: string })
            : Array.isArray(plantObj)
              ? (plantObj[0] as { code?: string; name?: string })
              : null;

        const evidence_files = fileRows.map((ev) => ({
          id: ev.id,
          created_at: ev.created_at,
          updated_at: ev.updated_at,
          original_name: ev.original_name,
          uploaded_by: ev.uploaded_by,
          uploaded_by_name: ev.uploaded_by ? uploaderNames[ev.uploaded_by] ?? null : null,
          file_path: ev.file_path,
        }));

        const latest = pickLatestEvidence(fileRows);

        return {
          order_id: o.id,
          order_number: o.order_number,
          delivery_date: o.delivery_date,
          construction_site: o.construction_site,
          plant_id: o.plant_id,
          plant_code: plantFlat?.code ?? null,
          plant_name: plantFlat?.name ?? null,
          client_id: o.client_id,
          client_name: clientName ?? null,
          concrete_remisiones_count: concreteCount,
          has_evidence: fileRows.length > 0,
          evidence_count: fileRows.length,
          evidence_files,
          evidence_last_at: latest ? latest.updated_at || latest.created_at : null,
          evidence_last_uploader_name:
            latest?.uploaded_by ? uploaderNames[latest.uploaded_by] ?? null : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          rows,
          total,
          truncated,
        },
      });
    }

    // --- Not missing_only: paginate orders first, then hydrate ---
    let ordersQuery = buildBaseOrdersQuery()
      .order('delivery_date', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: orders, error: ordErr, count } = await ordersQuery;

    if (ordErr) {
      console.error('finanzas concrete-evidence orders:', ordErr);
      return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
    }

    const orderList = orders || [];
    const orderIds = orderList.map((o: { id: string }) => o.id);
    if (orderIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { rows: [], total: count ?? 0, truncated: false },
      });
    }

    const { data: evidenceRows, error: evErr } = await supabase
      .from('order_concrete_evidence')
      .select('order_id, id, created_at, updated_at, original_name, uploaded_by, file_path')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });

    if (evErr) {
      console.error('finanzas concrete-evidence evidence:', evErr);
      return NextResponse.json({ error: 'Error al cargar evidencia' }, { status: 500 });
    }

    const evidenceByOrder = new Map<string, OrderConcreteEvidenceRow[]>();
    for (const e of (evidenceRows || []) as OrderConcreteEvidenceRow[]) {
      const list = evidenceByOrder.get(e.order_id) || [];
      list.push(e);
      evidenceByOrder.set(e.order_id, list);
    }

    const { data: remisionesCounts, error: cErr } = await supabase
      .from('remisiones')
      .select('order_id')
      .in('order_id', orderIds)
      .eq('tipo_remision', 'CONCRETO');

    if (cErr) {
      console.error('finanzas concrete-evidence remisiones:', cErr);
      return NextResponse.json({ error: 'Error al contar remisiones' }, { status: 500 });
    }

    const countByOrder = new Map<string, number>();
    for (const r of remisionesCounts || []) {
      const oid = (r as { order_id: string }).order_id;
      countByOrder.set(oid, (countByOrder.get(oid) || 0) + 1);
    }

    const uploaderIds = Array.from(
      new Set(
        ((evidenceRows || []) as OrderConcreteEvidenceRow[])
          .map((e) => e.uploaded_by)
          .filter((id): id is string => Boolean(id))
      )
    );
    const uploaderNames: Record<string, string> = {};
    if (uploaderIds.length > 0) {
      const { data: ups } = await supabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', uploaderIds);
      for (const u of ups || []) {
        uploaderNames[u.id] = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.id;
      }
    }

    const rows = orderList.map((o: any) => {
      const fileRows = evidenceByOrder.get(o.id) || [];
      const concreteCount = countByOrder.get(o.id) || 0;
      const clientName =
        o.clients && typeof o.clients === 'object' && !Array.isArray(o.clients)
          ? (o.clients as { business_name?: string }).business_name
          : Array.isArray(o.clients)
            ? (o.clients[0] as { business_name?: string })?.business_name
            : null;

      const plantObj = o.plant;
      const plantFlat =
        plantObj && typeof plantObj === 'object' && !Array.isArray(plantObj)
          ? (plantObj as { code?: string; name?: string })
          : Array.isArray(plantObj)
            ? (plantObj[0] as { code?: string; name?: string })
            : null;

      const evidence_files = fileRows.map((ev) => ({
        id: ev.id,
        created_at: ev.created_at,
        updated_at: ev.updated_at,
        original_name: ev.original_name,
        uploaded_by: ev.uploaded_by,
        uploaded_by_name: ev.uploaded_by ? uploaderNames[ev.uploaded_by] ?? null : null,
        file_path: ev.file_path,
      }));

      const latest = pickLatestEvidence(fileRows);

      return {
        order_id: o.id,
        order_number: o.order_number,
        delivery_date: o.delivery_date,
        construction_site: o.construction_site,
        plant_id: o.plant_id,
        plant_code: plantFlat?.code ?? null,
        plant_name: plantFlat?.name ?? null,
        client_id: o.client_id,
        client_name: clientName ?? null,
        concrete_remisiones_count: concreteCount,
        has_evidence: fileRows.length > 0,
        evidence_count: fileRows.length,
        evidence_files,
        evidence_last_at: latest ? latest.updated_at || latest.created_at : null,
        evidence_last_uploader_name:
          latest?.uploaded_by ? uploaderNames[latest.uploaded_by] ?? null : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total: count ?? rows.length,
        truncated: false,
      },
    });
  } catch (e) {
    console.error('finanzas concrete-evidence GET:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
