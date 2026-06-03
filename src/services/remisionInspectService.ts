import { createServiceClient } from '@/lib/supabase/server';
import type {
  RemisionInspectDetail,
  RemisionInspectDetailRemision,
  RemisionInspectListResult,
  RemisionInspectListRow,
  RemisionInspectMuestreoSummary,
  RemisionInspectSiteCheckSummary,
} from '@/types/remisionInspect';

const LIST_SELECT = `
  id,
  remision_number,
  fecha,
  hora_carga,
  volumen_fabricado,
  conductor,
  unidad,
  plant_id,
  order_id,
  is_production_record,
  cross_plant_billing_plant_id,
  cancelled_reason,
  recipe:recipes(recipe_code),
  orders:order_id(
    id,
    construction_site,
    clients:client_id(business_name)
  )
`;

const DETAIL_SELECT = `
  id,
  remision_number,
  fecha,
  hora_carga,
  volumen_fabricado,
  conductor,
  unidad,
  plant_id,
  order_id,
  is_production_record,
  cross_plant_billing_plant_id,
  cross_plant_billing_remision_id,
  cancelled_reason,
  recipe:recipes(recipe_code, strength_fc, slump, tma, age_days, age_hours),
  plants:plant_id(id, code, name),
  orders:order_id(
    id,
    order_number,
    construction_site,
    clients:client_id(business_name)
  )
`;

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeSearchTerm(q: string): string {
  return q.trim().toLowerCase();
}

function rowMatchesSearch(row: {
  remision_number: string;
  conductor: string | null;
  unidad: string | null;
  recipe_code: string | null;
  client_name: string | null;
  construction_site: string | null;
}, q: string): boolean {
  const term = normalizeSearchTerm(q);
  if (!term) return true;
  const haystack = [
    row.remision_number,
    row.conductor,
    row.unidad,
    row.recipe_code,
    row.client_name,
    row.construction_site,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(term);
}

function mapListRow(
  r: Record<string, unknown>,
  muestreoCountByRemision: Map<string, number>,
): RemisionInspectListRow {
  const order = unwrapOne(r.orders as { id?: string; construction_site?: string; clients?: unknown } | null);
  const client = unwrapOne(
    order?.clients as { business_name?: string } | null,
  );
  const recipe = unwrapOne(r.recipe as { recipe_code?: string } | null);
  const id = r.id as string;
  const muestreoCount = muestreoCountByRemision.get(id) ?? 0;

  return {
    id,
    remision_number: String(r.remision_number ?? ''),
    fecha: String(r.fecha ?? ''),
    hora_carga: (r.hora_carga as string | null) ?? null,
    volumen_fabricado: (r.volumen_fabricado as number | null) ?? null,
    conductor: (r.conductor as string | null) ?? null,
    unidad: (r.unidad as string | null) ?? null,
    client_name: client?.business_name ?? null,
    construction_site: order?.construction_site ?? null,
    recipe_code: recipe?.recipe_code ?? null,
    order_id: order?.id ?? null,
    is_production_record: Boolean(r.is_production_record),
    is_cross_plant_billing: Boolean(r.cross_plant_billing_plant_id),
    has_muestreo: muestreoCount > 0,
    muestreo_count: muestreoCount,
    cancelled_reason: (r.cancelled_reason as string | null) ?? null,
  };
}

async function fetchMuestreoCounts(
  supabase: ReturnType<typeof createServiceClient>,
  remisionIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (remisionIds.length === 0) return counts;

  const chunkSize = 100;
  for (let i = 0; i < remisionIds.length; i += chunkSize) {
    const chunk = remisionIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('muestreos')
      .select('remision_id')
      .in('remision_id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      const rid = row.remision_id as string;
      if (!rid) continue;
      counts.set(rid, (counts.get(rid) ?? 0) + 1);
    }
  }
  return counts;
}

export async function searchRemisionesForInspect(params: {
  plantId: string;
  dateFrom: string;
  dateTo: string;
  q?: string;
  limit?: number;
}): Promise<RemisionInspectListResult> {
  const { plantId, dateFrom, dateTo, q, limit = 80 } = params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('remisiones')
    .select(LIST_SELECT)
    .eq('plant_id', plantId)
    .eq('tipo_remision', 'CONCRETO')
    .gte('fecha', dateFrom)
    .lte('fecha', dateTo)
    .order('fecha', { ascending: false })
    .order('hora_carga', { ascending: false })
    .limit(Math.min(limit * 3, 300));

  if (error) throw error;

  const rawRows = (data ?? []) as Record<string, unknown>[];
  const ids = rawRows.map((r) => r.id as string);
  const muestreoCounts = await fetchMuestreoCounts(supabase, ids);

  let rows = rawRows.map((r) => mapListRow(r, muestreoCounts));

  if (q?.trim()) {
    rows = rows.filter((row) => rowMatchesSearch(row, q));
  }

  rows = rows.slice(0, limit);

  return { rows, date_from: dateFrom, date_to: dateTo };
}

function mapDetailRemision(r: Record<string, unknown>): RemisionInspectDetailRemision {
  const order = unwrapOne(
    r.orders as {
      id?: string;
      order_number?: string;
      construction_site?: string;
      clients?: unknown;
    } | null,
  );
  const client = unwrapOne(order?.clients as { business_name?: string } | null);
  const recipe = unwrapOne(
    r.recipe as {
      recipe_code?: string;
      strength_fc?: number;
      slump?: number;
      tma?: number;
      age_days?: number;
      age_hours?: number;
    } | null,
  );
  const plants = unwrapOne(r.plants as { code?: string; name?: string } | null);

  return {
    id: r.id as string,
    remision_number: String(r.remision_number ?? ''),
    fecha: String(r.fecha ?? ''),
    hora_carga: (r.hora_carga as string | null) ?? null,
    volumen_fabricado: (r.volumen_fabricado as number | null) ?? null,
    conductor: (r.conductor as string | null) ?? null,
    unidad: (r.unidad as string | null) ?? null,
    plant_id: (r.plant_id as string | null) ?? null,
    planta: plants?.name ?? plants?.code ?? null,
    order_id: order?.id ?? null,
    order_number: order?.order_number ?? null,
    client_name: client?.business_name ?? null,
    construction_name: order?.construction_site ?? null,
    is_production_record: Boolean(r.is_production_record),
    cross_plant_billing_plant_id: (r.cross_plant_billing_plant_id as string | null) ?? null,
    cross_plant_billing_remision_id: (r.cross_plant_billing_remision_id as string | null) ?? null,
    cancelled_reason: (r.cancelled_reason as string | null) ?? null,
    recipe: recipe
      ? {
          recipe_code: recipe.recipe_code ?? null,
          strength_fc: recipe.strength_fc ?? null,
          slump: recipe.slump ?? null,
          tma: recipe.tma ?? null,
          age_days: recipe.age_days ?? null,
          age_hours: recipe.age_hours ?? null,
        }
      : null,
    plants,
  };
}

export async function getRemisionInspectDetail(
  remisionId: string,
  plantId?: string | null,
): Promise<RemisionInspectDetail | null> {
  const supabase = createServiceClient();

  let query = supabase.from('remisiones').select(DETAIL_SELECT).eq('id', remisionId);

  if (plantId) {
    query = query.eq('plant_id', plantId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const remision = mapDetailRemision(data as Record<string, unknown>);

  const [muestreosRes, siteChecksRes] = await Promise.all([
    supabase
      .from('muestreos')
      .select(
        'id, numero_muestreo, fecha_muestreo, hora_muestreo, revenimiento_sitio, masa_unitaria',
      )
      .eq('remision_id', remisionId)
      .order('fecha_muestreo', { ascending: false }),
    supabase
      .from('site_checks')
      .select(
        'id, remision_number_manual, fecha_muestreo, hora_llegada_obra, test_type, valor_final_cm, created_at',
      )
      .eq('remision_id', remisionId)
      .order('fecha_muestreo', { ascending: false }),
  ]);

  if (muestreosRes.error) throw muestreosRes.error;
  if (siteChecksRes.error) throw siteChecksRes.error;

  const muestreos: RemisionInspectMuestreoSummary[] = (muestreosRes.data ?? []).map((m) => ({
    id: m.id,
    numero_muestreo: m.numero_muestreo,
    fecha_muestreo: m.fecha_muestreo,
    hora_muestreo: m.hora_muestreo,
    revenimiento_sitio: m.revenimiento_sitio,
    masa_unitaria: m.masa_unitaria,
  }));

  const site_checks: RemisionInspectSiteCheckSummary[] = (siteChecksRes.data ?? []).map((s) => ({
    id: s.id,
    remision_number_manual: s.remision_number_manual,
    fecha_muestreo: s.fecha_muestreo,
    hora_llegada_obra: s.hora_llegada_obra,
    test_type: s.test_type,
    valor_final_cm: s.valor_final_cm,
    created_at: s.created_at,
  }));

  return { remision, muestreos, site_checks };
}
