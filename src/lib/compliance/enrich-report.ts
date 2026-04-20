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

/**
 * Adds human-readable order labels to findings that carry `orderId` in details.
 */
export async function enrichComplianceReport(
  cot: SupabaseClient<any>,
  report: DailyComplianceReport,
): Promise<DailyComplianceReport> {
  const idSet = collectOrderIdsFromFindings(report.findings);
  if (idSet.size === 0) return report;

  const ids = Array.from(idSet);
  const orderMap = new Map<string, OrderRow>();

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

  const enriched: ComplianceFinding[] = report.findings.map((f) => {
    const oid = f.details?.orderId;
    if (typeof oid !== 'string' || !orderMap.has(oid)) return f;
    const o = orderMap.get(oid)!;
    const clientName = o.clients?.business_name?.trim() || '';
    const site = o.construction_site?.trim() || '';
    const num = o.order_number != null ? String(o.order_number) : '';
    const orderLabel = num ? `Pedido #${num}` : `Pedido`;
    const clientLabel = [clientName, site].filter(Boolean).join(' · ') || '—';
    return {
      ...f,
      details: {
        ...f.details,
        order_label: orderLabel,
        order_number: o.order_number,
        client_name: clientName || null,
        construction_site: site || null,
        client_label: clientLabel,
      },
    };
  });

  return {
    ...report,
    findings: enriched,
    byPlantCategory: rebuildByPlantCategory(enriched),
  };
}
