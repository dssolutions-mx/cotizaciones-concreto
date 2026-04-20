/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase service client vs generic variance */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ComplianceFinding,
  DailyComplianceReport,
} from '../../../supabase/functions/_shared/compliance-core';

type OrderRow = {
  id: string;
  order_number: number | null;
  construction_site: string | null;
  clients: { business_name: string | null } | null;
};

function normalizeOrderRow(raw: unknown): OrderRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = row.id;
  if (typeof id !== 'string') return null;
  const cr = row.clients;
  let business_name: string | null = null;
  if (cr && typeof cr === 'object') {
    if (Array.isArray(cr) && cr[0] && typeof cr[0] === 'object') {
      business_name = (cr[0] as { business_name?: string }).business_name ?? null;
    } else if (!Array.isArray(cr)) {
      business_name = (cr as { business_name?: string }).business_name ?? null;
    }
  }
  return {
    id,
    order_number: typeof row.order_number === 'number' ? row.order_number : null,
    construction_site: typeof row.construction_site === 'string' ? row.construction_site : null,
    clients: business_name ? { business_name } : null,
  };
}

function collectOrderIdsFromFindings(findings: ComplianceFinding[]): Set<string> {
  const ids = new Set<string>();
  for (const f of findings) {
    const oid = f.details?.orderId;
    if (typeof oid === 'string' && /^[0-9a-f-]{36}$/i.test(oid)) ids.add(oid);
  }
  return ids;
}

function collectUserIdsFromFindings(findings: ComplianceFinding[]): Set<string> {
  const ids = new Set<string>();
  const isUuid = (v: unknown): v is string =>
    typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
  for (const f of findings) {
    const d = f.details;
    // createdBys array (missingChecklist, missingEvidence, missingPumping)
    if (Array.isArray(d?.createdBys)) {
      for (const id of d.createdBys as unknown[]) if (isUuid(id)) ids.add(id);
    }
    // createdBy scalar (operatorMismatch)
    if (isUuid(d?.createdBy)) ids.add(d.createdBy as string);
  }
  return ids;
}

function rebuildByPlantCategory(
  findings: ComplianceFinding[],
): DailyComplianceReport['byPlantCategory'] {
  const byPlantCategory: DailyComplianceReport['byPlantCategory'] = {};
  for (const f of findings) {
    if (!byPlantCategory[f.plantId]) byPlantCategory[f.plantId] = {};
    const bucket = byPlantCategory[f.plantId]!;
    if (!bucket[f.rule]) bucket[f.rule] = [];
    bucket[f.rule]!.push(f);
  }
  return byPlantCategory;
}

function buildOrderLabel(o: OrderRow): { orderLabel: string; clientLabel: string } {
  const clientName = o.clients?.business_name?.trim() || '';
  const site = o.construction_site?.trim() || '';
  const num = o.order_number != null ? String(o.order_number) : '';
  const orderLabel = num ? `Pedido #${num}` : 'Pedido';
  const clientLabel = [clientName, site].filter(Boolean).join(' · ') || '—';
  return { orderLabel, clientLabel };
}

/**
 * Adds human-readable labels to all findings:
 * - order_label / client_label for findings with orderId
 * - dosificador_names[] for findings with createdBys / createdBy
 */
export async function enrichComplianceReport(
  cot: SupabaseClient<any>,
  report: DailyComplianceReport,
): Promise<DailyComplianceReport> {
  const orderIdSet = collectOrderIdsFromFindings(report.findings);
  const userIdSet = collectUserIdsFromFindings(report.findings);

  // Fetch orders
  const orderMap = new Map<string, OrderRow>();
  if (orderIdSet.size > 0) {
    const ids = Array.from(orderIdSet);
    const chunkSize = 80;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      const { data, error } = await cot
        .from('orders')
        .select('id, order_number, construction_site, clients:client_id(business_name)')
        .in('id', slice);
      if (error) {
        console.warn('[enrichComplianceReport] orders fetch', error.message);
        continue;
      }
      for (const raw of data ?? []) {
        const row = normalizeOrderRow(raw);
        if (row) orderMap.set(row.id, row);
      }
    }
  }

  // Fetch user display names for dosificadores
  const userNameMap = new Map<string, string>();
  if (userIdSet.size > 0) {
    const ids = Array.from(userIdSet);
    const { data, error } = await cot
      .from('user_profiles')
      .select('id, first_name, last_name, email')
      .in('id', ids);
    if (error) {
      console.warn('[enrichComplianceReport] user_profiles fetch', error.message);
    }
    for (const raw of (data ?? []) as Array<{ id: string; first_name?: string | null; last_name?: string | null; email?: string | null }>) {
      const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || raw.email || raw.id;
      userNameMap.set(raw.id, name);
    }
  }

  const resolveUserNames = (ids: string[]): string[] =>
    ids.map((id) => userNameMap.get(id) ?? id).filter(Boolean);

  const enriched: ComplianceFinding[] = report.findings.map((f) => {
    const d = f.details;
    let extra: Record<string, unknown> = {};

    // Order context for any finding with orderId
    const oid = d?.orderId;
    if (typeof oid === 'string' && orderMap.has(oid)) {
      const o = orderMap.get(oid)!;
      const { orderLabel, clientLabel } = buildOrderLabel(o);
      extra = {
        ...extra,
        order_label: orderLabel,
        order_number: o.order_number,
        client_name: o.clients?.business_name?.trim() || null,
        construction_site: o.construction_site?.trim() || null,
        client_label: clientLabel,
      };
    }

    // Dosificador names from createdBys array
    if (Array.isArray(d?.createdBys) && (d.createdBys as string[]).length > 0) {
      extra = {
        ...extra,
        dosificador_names: resolveUserNames(d.createdBys as string[]),
      };
    }

    // Dosificador name from scalar createdBy (operatorMismatch)
    if (typeof d?.createdBy === 'string' && d.createdBy) {
      extra = {
        ...extra,
        dosificador_name: userNameMap.get(d.createdBy as string) ?? d.createdBy,
      };
    }

    if (Object.keys(extra).length === 0) return f;
    return { ...f, details: { ...d, ...extra } };
  });

  return {
    ...report,
    findings: enriched,
    byPlantCategory: rebuildByPlantCategory(enriched),
  };
}
