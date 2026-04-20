import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mergeComplianceOverrides,
  parseComplianceOverridesJson,
  type ComplianceOverridesMap,
  type PlantOverride,
} from '@/lib/compliance/recipients';

/** Env (`COMPLIANCE_OVERRIDES_JSON`) merged with `compliance_plant_email_overrides` rows. */
export async function fetchMergedComplianceOverrides(
  cot: SupabaseClient<any>,
): Promise<ComplianceOverridesMap> {
  const envMap = parseComplianceOverridesJson(process.env.COMPLIANCE_OVERRIDES_JSON);
  const { data: rows, error } = await cot.from('compliance_plant_email_overrides').select(
    'plant_id, dosificador_email, jefe_planta_email, extra_cc',
  );
  if (error || !rows?.length) return envMap;

  const { data: plants } = await cot.from('plants').select('id, code');
  const idToCode = new Map((plants ?? []).map((p) => [p.id, p.code]));

  const dbMap: ComplianceOverridesMap = {};
  for (const r of rows) {
    const code = idToCode.get(r.plant_id);
    if (!code) continue;
    const patch: PlantOverride = {};
    if (r.dosificador_email?.trim()) patch.dosificador = r.dosificador_email.trim();
    if (r.jefe_planta_email?.trim()) patch.jefe_planta = r.jefe_planta_email.trim();
    if (r.extra_cc?.length) {
      const xs = r.extra_cc.map((e: string) => e.trim()).filter((e: string) => e.includes('@'));
      if (xs.length) patch.extra_cc = xs;
    }
    if (Object.keys(patch).length) dbMap[code] = patch;
  }
  return mergeComplianceOverrides(envMap, dbMap);
}
