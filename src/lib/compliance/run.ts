import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type PlantOperatingRow,
  type RunComplianceInput,
  runComplianceCheck,
} from '../../../supabase/functions/_shared/compliance-core';

export { runComplianceCheck, mexicoDayBoundsIso, resolveCanonicalUnitId } from '../../../supabase/functions/_shared/compliance-core';

export type {
  DailyComplianceReport,
  ComplianceFinding,
  ComplianceRuleId,
} from '../../../supabase/functions/_shared/compliance-core';

export async function buildComplianceRunInput(
  cot: SupabaseClient,
  targetDate: string,
): Promise<RunComplianceInput> {
  const { data: aliasRows } = await cot
    .from('compliance_unit_aliases')
    .select('remision_unit_name, canonical_asset_id');
  const unitAliases: Record<string, string> = {};
  for (const row of aliasRows ?? []) {
    const r = row as { remision_unit_name: string; canonical_asset_id: string };
    unitAliases[r.remision_unit_name.trim().toUpperCase()] =
      r.canonical_asset_id.trim().toUpperCase();
  }

  const { data: exRows } = await cot
    .from('compliance_unit_exemptions')
    .select('unit_name');
  const exemptUnits = new Set(
    (exRows ?? []).map((e: { unit_name: string }) =>
      e.unit_name.trim().toUpperCase().replace(/\s+/g, ' '),
    ),
  );

  const { data: opRows } = await cot.from('plant_operating_days').select('*');
  const operatingByPlant = new Map<string, PlantOperatingRow | null>();
  for (const p of opRows ?? []) {
    const row = p as PlantOperatingRow;
    operatingByPlant.set(row.plant_id, row);
  }

  return {
    targetDate,
    unitAliases,
    exemptUnits,
    operatingByPlant,
  };
}

/** Previous working day: Mon -> Sat; Sun -> Fri; else y-1. */
export function defaultComplianceDateUtcString(today = new Date()): string {
  const d = new Date(
    Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      12,
      0,
      0,
    ),
  );
  const dow = d.getUTCDay();
  let back = 1;
  if (dow === 1) back = 2;
  if (dow === 0) back = 2;
  d.setUTCDate(d.getUTCDate() - back);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function executeComplianceRun(
  cot: SupabaseClient,
  mnt: SupabaseClient,
  targetDate: string,
) {
  const input = await buildComplianceRunInput(cot, targetDate);
  const raw = await runComplianceCheck(cot, mnt, input);
  const { enrichComplianceReport } = await import('@/lib/compliance/enrich-report');
  return enrichComplianceReport(cot as any, raw);
}
