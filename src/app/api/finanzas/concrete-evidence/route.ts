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

    let ordersQuery = supabase
      .from('orders')
      .select(
        `
        id,
        order_number,
        delivery_date,
        construction_site,
        plant_id,
        client_id,
        clients:clients ( business_name )
      `,
        { count: 'exact' }
      )
      .order('delivery_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (fromYmd) ordersQuery = ordersQuery.gte('delivery_date', fromYmd);
    if (toYmd) ordersQuery = ordersQuery.lte('delivery_date', toYmd);

    const effectivePlantId = profile.plant_id ?? (plantIdParam || null);
    if (effectivePlantId) {
      ordersQuery = ordersQuery.eq('plant_id', effectivePlantId);
    }

    if (clientId) {
      ordersQuery = ordersQuery.eq('client_id', clientId);
    }

    ordersQuery = ordersQuery.in('order_status', [
      'created',
      'validated',
      'scheduled',
      'CREATED',
      'VALIDATED',
      'SCHEDULED',
    ]);

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
        data: { rows: [], total: count ?? 0 },
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

    let rows = orderList.map((o: any) => {
      const fileRows = evidenceByOrder.get(o.id) || [];
      const concreteCount = countByOrder.get(o.id) || 0;
      const clientName =
        o.clients && typeof o.clients === 'object' && !Array.isArray(o.clients)
          ? (o.clients as { business_name?: string }).business_name
          : Array.isArray(o.clients)
            ? (o.clients[0] as { business_name?: string })?.business_name
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

    if (missingOnly) {
      rows = rows.filter((r) => !r.has_evidence && r.concrete_remisiones_count > 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        rows,
        total: count ?? rows.length,
      },
    });
  } catch (e) {
    console.error('finanzas concrete-evidence GET:', e);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
