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

/** Max orders to evaluate for filtered modes / KPI summary (safety cap). */
const MAX_ORDERS_EVALUATE = 20000;

const ORDER_STATUSES = [
  'created',
  'validated',
  'scheduled',
  'CREATED',
  'VALIDATED',
  'SCHEDULED',
];

type EvidenceStatusFilter = 'all' | 'needs_evidence' | 'has_evidence' | 'no_remisiones';

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
  mime_type: string | null;
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

function parseEvidenceStatus(searchParams: URLSearchParams): EvidenceStatusFilter {
  const legacyMissing =
    searchParams.get('missing_only') === '1' || searchParams.get('missing_only') === 'true';
  const raw = (searchParams.get('evidence_status') || '').trim().toLowerCase();
  const allowed: EvidenceStatusFilter[] = ['all', 'needs_evidence', 'has_evidence', 'no_remisiones'];
  if (legacyMissing) return 'needs_evidence';
  if (allowed.includes(raw as EvidenceStatusFilter)) return raw as EvidenceStatusFilter;
  return 'all';
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

type RemisionMeta = { remision_numbers: string[]; concrete_volume_sum: number };

async function remisionMetaByOrder(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  orderIds: string[]
): Promise<Map<string, RemisionMeta>> {
  const map = new Map<string, RemisionMeta>();
  for (const part of chunk(orderIds, 400)) {
    const { data, error } = await supabase
      .from('remisiones')
      .select('order_id, remision_number, volumen_fabricado')
      .in('order_id', part)
      .eq('tipo_remision', 'CONCRETO');
    if (error) throw error;
    for (const r of data || []) {
      const row = r as {
        order_id: string;
        remision_number: string | null;
        volumen_fabricado: number | null;
      };
      const cur = map.get(row.order_id) || { remision_numbers: [] as string[], concrete_volume_sum: 0 };
      if (row.remision_number) cur.remision_numbers.push(String(row.remision_number).trim());
      cur.concrete_volume_sum += Number(row.volumen_fabricado) || 0;
      map.set(row.order_id, cur);
    }
  }
  for (const [, meta] of map) {
    meta.remision_numbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }
  return map;
}

function filterOrdersByEvidenceStatus(
  ordered: any[],
  countByOrder: Map<string, number>,
  evidenceOrders: Set<string>,
  status: EvidenceStatusFilter
): any[] {
  if (status === 'all') return ordered;
  const out: any[] = [];
  for (const o of ordered) {
    const c = countByOrder.get(o.id) || 0;
    const ev = evidenceOrders.has(o.id);
    if (status === 'needs_evidence' && c > 0 && !ev) out.push(o);
    else if (status === 'has_evidence' && c > 0 && ev) out.push(o);
    else if (status === 'no_remisiones' && c === 0) out.push(o);
  }
  return out;
}

type SummaryPayload = {
  orders_in_range: number;
  orders_evaluated: number;
  summary_truncated: boolean;
  with_concrete_remisiones: number;
  needs_evidence: number;
  has_evidence: number;
  no_remisiones: number;
  coverage_pct: number;
};

async function computeSummary(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  applyOrderFilters: (q: any) => any
): Promise<SummaryPayload> {
  const { count: ordersInRange, error: cErr } = await applyOrderFilters(
    supabase.from('orders').select('id', { count: 'exact', head: true })
  );
  if (cErr) throw cErr;

  const { data: evalRows, error: eErr } = await applyOrderFilters(
    supabase.from('orders').select('id')
  )
    .order('delivery_date', { ascending: false })
    .limit(MAX_ORDERS_EVALUATE);
  if (eErr) throw eErr;

  const evalIds = (evalRows || []).map((r: { id: string }) => r.id);
  const rangeTotal = ordersInRange ?? 0;
  const summaryTruncated = rangeTotal > MAX_ORDERS_EVALUATE || evalIds.length >= MAX_ORDERS_EVALUATE;

  if (evalIds.length === 0) {
    return {
      orders_in_range: rangeTotal,
      orders_evaluated: 0,
      summary_truncated: summaryTruncated,
      with_concrete_remisiones: 0,
      needs_evidence: 0,
      has_evidence: 0,
      no_remisiones: 0,
      coverage_pct: 0,
    };
  }

  const countByOrder = await countConcreteRemisionesByOrder(supabase, evalIds);
  const evidenceOrders = await orderIdsWithEvidence(supabase, evalIds);

  let withConcrete = 0;
  let needsEvidence = 0;
  let hasEvidence = 0;
  let noRemisiones = 0;

  for (const id of evalIds) {
    const c = countByOrder.get(id) || 0;
    const ev = evidenceOrders.has(id);
    if (c === 0) {
      noRemisiones++;
    } else {
      withConcrete++;
      if (ev) hasEvidence++;
      else needsEvidence++;
    }
  }

  const coveragePct = withConcrete > 0 ? Math.round((hasEvidence / withConcrete) * 1000) / 10 : 0;

  return {
    orders_in_range: rangeTotal,
    orders_evaluated: evalIds.length,
    summary_truncated: summaryTruncated,
    with_concrete_remisiones: withConcrete,
    needs_evidence: needsEvidence,
    has_evidence: hasEvidence,
    no_remisiones: noRemisiones,
    coverage_pct: coveragePct,
  };
}

function mapOrderRow(
  o: any,
  fileRows: OrderConcreteEvidenceRow[],
  concreteCount: number,
  uploaderNames: Record<string, string>,
  remMeta: RemisionMeta | undefined
) {
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
    mime_type: ev.mime_type ?? null,
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
    concrete_volume_sum: remMeta?.concrete_volume_sum ?? null,
    remision_numbers: remMeta?.remision_numbers ?? [],
    has_evidence: fileRows.length > 0,
    evidence_count: fileRows.length,
    evidence_files,
    evidence_last_at: latest ? latest.updated_at || latest.created_at : null,
    evidence_last_uploader_name:
      latest?.uploaded_by ? uploaderNames[latest.uploaded_by] ?? null : null,
  };
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
    const evidenceStatus = parseEvidenceStatus(searchParams);
    const includeSummary =
      searchParams.get('include_summary') === '1' || searchParams.get('include_summary') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '80', 10) || 80, 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const fromYmd = parseYmd(dateFrom) || dateFrom;
    const toYmd = parseYmd(dateTo) || dateTo;

    const effectivePlantId = effectivePlantIdForFinanzas(profile, plantIdParam);

    const applyOrderFilters = (q: any) => {
      let x = q;
      if (fromYmd) x = x.gte('delivery_date', fromYmd);
      if (toYmd) x = x.lte('delivery_date', toYmd);
      if (effectivePlantId) x = x.eq('plant_id', effectivePlantId);
      if (clientId) x = x.eq('client_id', clientId);
      x = x.in('order_status', ORDER_STATUSES);
      return x;
    };

    const buildBaseOrdersQuery = () =>
      applyOrderFilters(
        supabase.from('orders').select(
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
        )
      );

    let summary: SummaryPayload | null = null;
    if (includeSummary && offset === 0) {
      try {
        summary = await computeSummary(supabase, applyOrderFilters);
      } catch (e) {
        console.error('finanzas concrete-evidence summary:', e);
        summary = null;
      }
    }

    // --- Filtered modes: scan capped window, filter, paginate ---
    if (evidenceStatus !== 'all') {
      const { data: orderRows, error: ordErr } = await buildBaseOrdersQuery()
        .order('delivery_date', { ascending: false })
        .limit(MAX_ORDERS_EVALUATE);

      if (ordErr) {
        console.error('finanzas concrete-evidence orders (filtered):', ordErr);
        return NextResponse.json({ error: 'Error al cargar pedidos' }, { status: 500 });
      }

      const ordered = (orderRows || []) as any[];
      const allIds = ordered.map((o) => o.id as string);
      if (allIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: { rows: [], total: 0, truncated: false, summary, evidence_status: evidenceStatus },
        });
      }

      let countByOrder: Map<string, number>;
      let evidenceOrders: Set<string>;
      try {
        countByOrder = await countConcreteRemisionesByOrder(supabase, allIds);
        evidenceOrders = await orderIdsWithEvidence(supabase, allIds);
      } catch (e) {
        console.error('finanzas concrete-evidence filtered batch:', e);
        return NextResponse.json({ error: 'Error al evaluar remisiones/evidencia' }, { status: 500 });
      }

      const filteredOrdered = filterOrdersByEvidenceStatus(
        ordered,
        countByOrder,
        evidenceOrders,
        evidenceStatus
      );

      const total = filteredOrdered.length;
      const truncated = ordered.length >= MAX_ORDERS_EVALUATE;
      const pageOrders = filteredOrdered.slice(offset, offset + limit);
      const pageIds = pageOrders.map((o) => o.id);

      if (pageIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: { rows: [], total, truncated, summary, evidence_status: evidenceStatus },
        });
      }

      const { data: evidenceRows, error: evErr } = await supabase
        .from('order_concrete_evidence')
        .select(
          'order_id, id, created_at, updated_at, original_name, uploaded_by, file_path, mime_type'
        )
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

      const { data: remisionesRows, error: cErr } = await supabase
        .from('remisiones')
        .select('order_id')
        .in('order_id', pageIds)
        .eq('tipo_remision', 'CONCRETO');

      if (cErr) {
        console.error('finanzas concrete-evidence remisiones:', cErr);
        return NextResponse.json({ error: 'Error al contar remisiones' }, { status: 500 });
      }

      const remCountPage = new Map<string, number>();
      for (const r of remisionesRows || []) {
        const oid = (r as { order_id: string }).order_id;
        remCountPage.set(oid, (remCountPage.get(oid) || 0) + 1);
      }

      let remMetaMap: Map<string, RemisionMeta>;
      try {
        remMetaMap = await remisionMetaByOrder(supabase, pageIds);
      } catch (e) {
        console.error('finanzas concrete-evidence remision meta:', e);
        return NextResponse.json({ error: 'Error al cargar remisiones' }, { status: 500 });
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
        const remMeta = remMetaMap.get(o.id);
        return mapOrderRow(o, fileRows, concreteCount, uploaderNames, remMeta);
      });

      return NextResponse.json({
        success: true,
        data: {
          rows,
          total,
          truncated,
          summary,
          evidence_status: evidenceStatus,
        },
      });
    }

    // --- all: paginate orders with exact count ---
    const ordersQuery = applyOrderFilters(
      supabase.from('orders').select(
        `
        id,
        order_number,
        delivery_date,
        construction_site,
        plant_id,
        client_id,
        clients:clients ( business_name ),
        plant:plants!plant_id ( id, code, name )
      `,
        { count: 'exact' }
      )
    )
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
        data: {
          rows: [],
          total: count ?? 0,
          truncated: false,
          summary,
          evidence_status: evidenceStatus,
        },
      });
    }

    const { data: evidenceRows, error: evErr } = await supabase
      .from('order_concrete_evidence')
      .select('order_id, id, created_at, updated_at, original_name, uploaded_by, file_path, mime_type')
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

    let remMetaMap: Map<string, RemisionMeta>;
    try {
      remMetaMap = await remisionMetaByOrder(supabase, orderIds);
    } catch (e) {
      console.error('finanzas concrete-evidence remision meta:', e);
      return NextResponse.json({ error: 'Error al cargar remisiones' }, { status: 500 });
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
      const remMeta = remMetaMap.get(o.id);
      return mapOrderRow(o, fileRows, concreteCount, uploaderNames, remMeta);
    });

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total: count ?? rows.length,
        truncated: false,
        summary,
        evidence_status: evidenceStatus,
      },
    });
  } catch (e) {
    console.error('finanzas concrete-evidence GET:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
