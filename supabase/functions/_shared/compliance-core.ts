/**
 * Shared compliance engine (Deno Edge Function + Next.js import).
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type ComplianceRuleId =
  | 'missingProduction'
  | 'missingPumping'
  | 'missingMaterialEntries'
  | 'missingEvidence'
  | 'missingChecklist'
  | 'unknownUnit'
  | 'unknownBombeoUnit'
  | 'operatorMismatch'
  | 'noDieselActivity'
  | 'dieselWithoutProduction'
  | 'missingPumpingChecklist'
  | 'missingLoaderChecklist'
  | 'missingPipaChecklist'
  | 'waterEntryNoPipaInCatalog';

export type ComplianceSeverity = 'high' | 'info';

export interface ComplianceFinding {
  rule: ComplianceRuleId;
  severity: ComplianceSeverity;
  plantId: string;
  plantCode: string;
  findingKey: string;
  message: string;
  details: Record<string, unknown>;
}

export interface PlantComplianceSummary {
  plantId: string;
  plantCode: string;
  plantName: string;
  businessUnitId: string | null;
  producedConcreteM3: number;
  concretoRemisionCount: number;
  operatingDay: boolean;
}

export interface DailyComplianceReport {
  targetDate: string;
  timezone: 'America/Mexico_City';
  plants: PlantComplianceSummary[];
  findings: ComplianceFinding[];
  byPlantCategory: Record<
    string,
    Partial<Record<ComplianceRuleId, ComplianceFinding[]>>
  >;
}

const TZ = 'America/Mexico_City' as const;

export function mexicoDayBoundsIso(targetDate: string): {
  startIso: string;
  endExclusiveIso: string;
} {
  const startIso = `${targetDate}T00:00:00.000-06:00`;
  const [y, m, d] = targetDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  const ey = dt.getUTCFullYear();
  const em = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(dt.getUTCDate()).padStart(2, '0');
  const endExclusiveIso = `${ey}-${em}-${ed}T00:00:00.000-06:00`;
  return { startIso, endExclusiveIso };
}

export interface PlantOperatingRow {
  plant_id: string;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  sun: boolean;
}

export function weekdayKeyFromYmd(ymd: string): keyof Omit<
  PlantOperatingRow,
  'plant_id'
> {
  const [y, m, d] = ymd.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const map: (keyof Omit<PlantOperatingRow, 'plant_id'>)[] = [
    'sun',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
  ];
  return map[wd];
}

export interface RunComplianceInput {
  targetDate: string;
  /** keys and values: normalized upper unit codes, e.g. CR-EXT02 -> CR-02 */
  unitAliases: Record<string, string>;
  exemptUnits: Set<string>;
  operatingByPlant: Map<string, PlantOperatingRow | null>;
}

function normUnitKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Resolve remisión text to canonical asset_id string as stored in mantenimiento.assets.asset_id */
export function resolveCanonicalUnitId(
  raw: string,
  aliases: Record<string, string>,
): string {
  const nk = normUnitKey(raw);
  for (const [k, v] of Object.entries(aliases)) {
    if (normUnitKey(k) === nk) return normUnitKey(v);
  }
  return nk;
}

function normalizeTokens(s: string): Set<string> {
  const t = s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return new Set(t);
}

export function driverMatchesOperator(
  driverRaw: string,
  operatorRaw: string,
): boolean {
  const d = normalizeTokens(driverRaw);
  const o = normalizeTokens(operatorRaw);
  if (d.size === 0) return false;
  for (const tok of d) {
    if (!o.has(tok)) return false;
  }
  return true;
}

type AssetRow = {
  id: string;
  asset_id: string;
  plant_id: string;
  name: string;
  status: string;
  is_composite?: boolean | null;
  composite_type?: string | null;
  model_id?: string | null;
  /** Filled after batch load from equipment_models */
  _model_category?: string;
  _model_name?: string;
};

function modelMeta(a: AssetRow): { category: string; name: string } {
  return {
    category: a._model_category ?? '',
    name: a._model_name ?? '',
  };
}

function isOperationalAsset(a: AssetRow): boolean {
  return String(a.status ?? '').toLowerCase() === 'operational';
}

/** Normalize BP01 / BP-01 / BP04 → BP-01, BP-04 for matching mantenimiento asset_id prefixes. */
export function normalizePumpUnitCode(raw: string): string {
  const v = normUnitKey(raw);
  const m = v.match(/^BP-?0*(\d+)$/i);
  if (m) return `BP-${m[1].padStart(2, '0')}`;
  return v;
}

const EXTERNAL_PUMP_UNITS = new Set(
  [
    'BOMBA EXTERNA',
    'EXTERNA',
    'RENTADA',
    'RENTADA EXTERNA',
  ].map((s) => normUnitKey(s)),
);

function isExternalPumpUnit(raw: string): boolean {
  const nk = normUnitKey(raw);
  if (!nk) return true;
  if (EXTERNAL_PUMP_UNITS.has(nk)) return true;
  if (nk.includes('EXTERNA') && nk.includes('BOMBA')) return true;
  if (nk.startsWith('RENTADA')) return true;
  return false;
}

function findAssetForPumpUnit(
  assets: AssetRow[],
  canonAfterAlias: string,
  mntPlantUuid: string | undefined,
): AssetRow | undefined {
  const normalized = normalizePumpUnitCode(canonAfterAlias);
  const pool = mntPlantUuid
    ? assets.filter((a) => a.plant_id === mntPlantUuid)
    : assets;

  const byExact = (list: AssetRow[]) =>
    list.find((a) => normUnitKey(a.asset_id) === normUnitKey(normalized));

  let hit = byExact(pool);
  if (hit) return hit;

  const pref = `${normalized}-`;
  const byPrefix = (list: AssetRow[]) =>
    list.find((a) => {
      const ak = normUnitKey(a.asset_id);
      return ak === normalized || ak.startsWith(pref) || ak.startsWith(`${normalized} `);
    });

  hit = byPrefix(pool);
  if (hit) return hit;

  hit = byExact(assets);
  if (hit) return hit;
  return byPrefix(assets);
}

function isPipaAsset(a: AssetRow): boolean {
  const { category, name } = modelMeta(a);
  const cat = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nm = name.toLowerCase();
  const aid = normUnitKey(a.asset_id);
  if (aid.includes('PIPA') && aid.includes('AGUA')) return true;
  if (aid.startsWith('PIPA AGUA')) return true;
  if (nm.includes('pipa') && nm.includes('agua')) return true;
  if (nm.includes('water truck') || nm.includes('agua')) {
    if (cat.includes('camion') || cat.includes('camión')) return true;
  }
  return false;
}

function isLoaderAsset(a: AssetRow): boolean {
  return modelMeta(a).category === 'Cargador Frontal';
}

type RemRow = {
  id: string;
  plant_id: string;
  order_id: string;
  tipo_remision: string;
  unidad: string | null;
  conductor: string | null;
  volumen_fabricado: string | number | null;
  remision_number: string | null;
  hora_carga: string | null;
  created_by: string | null;
};

export async function runComplianceCheck(
  cot: SupabaseClient,
  mnt: SupabaseClient,
  input: RunComplianceInput,
): Promise<DailyComplianceReport> {
  const { startIso, endExclusiveIso } = mexicoDayBoundsIso(input.targetDate);
  const findings: ComplianceFinding[] = [];
  const wdKey = weekdayKeyFromYmd(input.targetDate);

  const { data: plantsData, error: plantsErr } = await cot
    .from('plants')
    .select('id, code, name, business_unit_id, is_active')
    .eq('is_active', true);
  if (plantsErr) throw plantsErr;

  const plants = (plantsData ?? []) as {
    id: string;
    code: string;
    name: string;
    business_unit_id: string | null;
  }[];

  const plantById = new Map(plants.map((p) => [p.id, p]));

  const { data: remisiones, error: remErr } = await cot
    .from('remisiones')
    .select(
      'id, plant_id, order_id, fecha, tipo_remision, unidad, conductor, volumen_fabricado, remision_number, hora_carga, created_by',
    )
    .eq('fecha', input.targetDate);
  if (remErr) throw remErr;

  const remList = (remisiones ?? []) as RemRow[];

  const orderIds = [...new Set(remList.map((r) => r.order_id).filter(Boolean))] as string[];

  const orderItemsMap = new Map<string, { has_pump_service: boolean }[]>();
  if (orderIds.length) {
    const { data: oi, error: oiErr } = await cot
      .from('order_items')
      .select('order_id, has_pump_service')
      .in('order_id', orderIds);
    if (oiErr) throw oiErr;
    for (const row of oi ?? []) {
      const oid = (row as { order_id: string }).order_id;
      const arr = orderItemsMap.get(oid) ?? [];
      arr.push({
        has_pump_service: Boolean(
          (row as { has_pump_service?: boolean }).has_pump_service,
        ),
      });
      orderItemsMap.set(oid, arr);
    }
  }

  const { data: entries, error: entErr } = await cot
    .from('material_entries')
    .select('plant_id')
    .eq('entry_date', input.targetDate);
  if (entErr) throw entErr;
  const plantsWithEntry = new Set(
    (entries ?? []).map((e: { plant_id: string }) => e.plant_id),
  );

  const { data: waterMaterials, error: wmErr } = await cot
    .from('materials')
    .select('id')
    .ilike('category', 'agua');
  if (wmErr) throw wmErr;
  const waterMaterialIds = [...new Set((waterMaterials ?? []).map((r: { id: string }) => r.id))];
  const plantsWithWaterEntry = new Set<string>();
  if (waterMaterialIds.length > 0) {
    const { data: waterEntries, error: weErr } = await cot
      .from('material_entries')
      .select('plant_id')
      .eq('entry_date', input.targetDate)
      .in('material_id', waterMaterialIds);
    if (weErr) throw weErr;
    for (const row of waterEntries ?? []) {
      plantsWithWaterEntry.add((row as { plant_id: string }).plant_id);
    }
  }

  const evidenceByOrder = new Map<string, number>();
  if (orderIds.length) {
    const { data: ev, error: evErr } = await cot
      .from('order_concrete_evidence')
      .select('order_id')
      .in('order_id', orderIds);
    if (evErr) throw evErr;
    for (const row of ev ?? []) {
      const oid = (row as { order_id: string }).order_id;
      evidenceByOrder.set(oid, (evidenceByOrder.get(oid) ?? 0) + 1);
    }
  }

  const { data: mntAssets, error: asErr } = await mnt
    .from('assets')
    .select(
      'id, asset_id, plant_id, name, status, is_composite, composite_type, model_id',
    );
  if (asErr) throw asErr;

  const rawAssets = (mntAssets ?? []) as AssetRow[];
  const modelIds = [...new Set(rawAssets.map((a) => a.model_id).filter(Boolean))] as string[];
  const modelById = new Map<string, { category: string; name: string }>();
  if (modelIds.length > 0) {
    const { data: emRows, error: emErr } = await mnt
      .from('equipment_models')
      .select('id, category, name')
      .in('id', modelIds);
    if (emErr) throw emErr;
    for (const row of emRows ?? []) {
      const m = row as { id: string; category: string; name: string };
      modelById.set(m.id, { category: m.category ?? '', name: m.name ?? '' });
    }
  }
  const assets: AssetRow[] = rawAssets.map((a) => {
    const mm = a.model_id ? modelById.get(a.model_id) : undefined;
    return {
      ...a,
      _model_category: mm?.category,
      _model_name: mm?.name,
    };
  });

  const assetById = new Map(assets.map((a) => [a.id, a]));

  const { data: acrData, error: acrErr } = await mnt
    .from('asset_composite_relationships')
    .select(
      'composite_asset_id, component_asset_id, status, detachment_date, attachment_date',
    );
  if (acrErr) throw acrErr;

  const pumpingCompositeToComponents = new Map<string, Set<string>>();
  const pumpingComponentToComposite = new Map<string, string>();
  const tDate = input.targetDate;
  for (const row of acrData ?? []) {
    const r = row as {
      composite_asset_id: string;
      component_asset_id: string;
      status: string | null;
      detachment_date: string | null;
      attachment_date: string | null;
    };
    if (String(r.status ?? '').toLowerCase() !== 'active') continue;
    const composite = assetById.get(r.composite_asset_id);
    if (!composite?.is_composite || composite.composite_type !== 'pumping_truck') continue;
    if (r.attachment_date && r.attachment_date > tDate) continue;
    if (r.detachment_date && r.detachment_date <= tDate) continue;
    if (!pumpingCompositeToComponents.has(r.composite_asset_id)) {
      pumpingCompositeToComponents.set(r.composite_asset_id, new Set());
    }
    pumpingCompositeToComponents.get(r.composite_asset_id)!.add(r.component_asset_id);
    pumpingComponentToComposite.set(r.component_asset_id, r.composite_asset_id);
  }

  function pumpChecklistClosure(asset: AssetRow): Set<string> {
    const out = new Set<string>([asset.id]);
    if (asset.is_composite && asset.composite_type === 'pumping_truck') {
      const kids = pumpingCompositeToComponents.get(asset.id);
      if (kids) for (const k of kids) out.add(k);
      return out;
    }
    const parent = pumpingComponentToComposite.get(asset.id);
    if (parent) {
      out.add(parent);
      const kids = pumpingCompositeToComponents.get(parent);
      if (kids) for (const k of kids) out.add(k);
    }
    return out;
  }

  function findAssetByCanon(canonUnitId: string): AssetRow | undefined {
    const nk = normUnitKey(canonUnitId);
    return assets.find((a) => normUnitKey(a.asset_id) === nk);
  }

  const { data: ccRows, error: ccErr } = await mnt
    .from('completed_checklists')
    .select('asset_id, completion_date, status')
    .gte('completion_date', startIso)
    .lt('completion_date', endExclusiveIso);
  if (ccErr) throw ccErr;

  const checklistAssetIds = new Set(
    (ccRows ?? []).map((c: { asset_id: string }) => c.asset_id),
  );

  const { data: aoRows, error: aoErr } = await mnt
    .from('asset_operators')
    .select(
      'asset_id, operator_id, status, assignment_type, start_date, end_date',
    )
    .eq('status', 'active')
    .eq('assignment_type', 'primary');
  if (aoErr) throw aoErr;

  const { data: profs, error: pErr } = await mnt
    .from('profiles')
    .select('id, nombre, apellido');
  if (pErr) throw pErr;
  const profById = new Map(
    (profs ?? []).map(
      (p: { id: string; nombre: string; apellido: string | null }) => [
        p.id,
        `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim(),
      ],
    ),
  );

  /** asset uuid -> operator display name */
  const primaryOperatorByAssetUuid = new Map<string, string>();
  for (const ao of aoRows ?? []) {
    const a = ao as {
      asset_id: string;
      operator_id: string;
      start_date: string;
      end_date: string | null;
    };
    const t = input.targetDate;
    if (a.start_date > t) continue;
    if (a.end_date && a.end_date < t) continue;
    const name = profById.get(a.operator_id) ?? '';
    primaryOperatorByAssetUuid.set(a.asset_id, name);
  }

  const { data: dwRows, error: dwErr } = await mnt
    .from('diesel_warehouses')
    .select('id, plant_id, product_type');
  if (dwErr) throw dwErr;

  const whToPlant = new Map<string, string>();
  for (const w of dwRows ?? []) {
    const row = w as { id: string; plant_id: string; product_type: string };
    whToPlant.set(row.id, row.plant_id);
  }

  const { data: dtRows, error: dtErr } = await mnt
    .from('diesel_transactions')
    .select('warehouse_id, transaction_type, quantity_liters, transaction_date')
    .gte('transaction_date', startIso)
    .lt('transaction_date', endExclusiveIso);
  if (dtErr) throw dtErr;

  const whRowById = new Map(
    (dwRows ?? []).map((w: { id: string; plant_id: string; product_type: string }) => [
      w.id,
      w,
    ]),
  );

  const dieselLitersByMntPlant = new Map<string, number>();
  for (const t of dtRows ?? []) {
    const tr = t as {
      warehouse_id: string;
      transaction_type: string;
      quantity_liters: string | number;
    };
    if (tr.transaction_type !== 'consumption') continue;
    const wrec = whRowById.get(tr.warehouse_id);
    if (!wrec || wrec.product_type !== 'diesel') continue;
    const pid = whToPlant.get(tr.warehouse_id);
    if (!pid) continue;
    const q = Number(tr.quantity_liters) || 0;
    dieselLitersByMntPlant.set(pid, (dieselLitersByMntPlant.get(pid) ?? 0) + q);
  }

  const mntPlantByCode = new Map<string, { id: string }>();
  const { data: mntPlants, error: mpErr } = await mnt
    .from('plants')
    .select('id, code');
  if (mpErr) throw mpErr;
  for (const p of mntPlants ?? []) {
    const row = p as { id: string; code: string };
    mntPlantByCode.set(row.code, { id: row.id });
  }

  const defaultDayFlags: Record<
    keyof Omit<PlantOperatingRow, 'plant_id'>,
    boolean
  > = {
    mon: true,
    tue: true,
    wed: true,
    thu: true,
    fri: true,
    sat: true,
    sun: false,
  };

  const summaries: PlantComplianceSummary[] = [];

  const missingChecklistMerge = new Map<
    string,
    {
      remisionIds: string[];
      remisionNumbers: string[];
      drivers: string[];
      horaCargas: string[];
      createdBys: string[];
      totalM3: number;
      sample: RemRow;
      asset: AssetRow;
      plant: (typeof plants)[0];
    }
  >();

  for (const p of plants) {
    const pod = input.operatingByPlant.get(p.id);
    const operating =
      pod != null
        ? Boolean(pod[wdKey])
        : Boolean(defaultDayFlags[wdKey]);

    const plantRem = remList.filter((r) => r.plant_id === p.id);
    const concreto = plantRem.filter((r) => r.tipo_remision === 'CONCRETO');
    const m3 = concreto.reduce(
      (s, r) => s + Number(r.volumen_fabricado ?? 0),
      0,
    );

    summaries.push({
      plantId: p.id,
      plantCode: p.code,
      plantName: p.name,
      businessUnitId: p.business_unit_id,
      producedConcreteM3: m3,
      concretoRemisionCount: concreto.length,
      operatingDay: operating,
    });

    if (operating && concreto.length === 0) {
      findings.push({
        rule: 'missingProduction',
        severity: 'high',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:missingProduction`,
        message: `Sin remisiones de CONCRETO el ${input.targetDate}`,
        details: {},
      });
    }

    if (concreto.length > 0 && !plantsWithEntry.has(p.id)) {
      const concM3 = concreto.reduce((s, r) => s + Number(r.volumen_fabricado ?? 0), 0);
      findings.push({
        rule: 'missingMaterialEntries',
        severity: 'high',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:missingMaterialEntries`,
        message: `Hay producción pero no hay entradas de material registradas`,
        details: {
          concretoRemisionCount: concreto.length,
          concretoM3: concM3,
        },
      });
    }

    const orderIdsForPlant = [...new Set(concreto.map((r) => r.order_id))] as string[];

    // Pre-aggregate per-order data for richer findings
    const orderAgg = new Map<string, {
      remisionNumbers: string[];
      drivers: string[];
      createdBys: string[];
      m3Total: number;
      count: number;
    }>();
    for (const r of concreto) {
      if (!r.order_id) continue;
      const agg = orderAgg.get(r.order_id) ?? { remisionNumbers: [], drivers: [], createdBys: [], m3Total: 0, count: 0 };
      if (r.remision_number) agg.remisionNumbers.push(r.remision_number);
      if (r.conductor) agg.drivers.push(r.conductor);
      if (r.created_by) agg.createdBys.push(r.created_by);
      agg.m3Total += Number(r.volumen_fabricado ?? 0);
      agg.count += 1;
      orderAgg.set(r.order_id, agg);
    }

    for (const oid of orderIdsForPlant) {
      const items = orderItemsMap.get(oid) ?? [];
      const needsPump = items.some((i) => i.has_pump_service);
      if (!needsPump) continue;
      const hasBombeo = plantRem.some(
        (r) => r.order_id === oid && r.tipo_remision === 'BOMBEO',
      );
      if (!hasBombeo) {
        const agg = orderAgg.get(oid);
        findings.push({
          rule: 'missingPumping',
          severity: 'high',
          plantId: p.id,
          plantCode: p.code,
          findingKey: `${p.id}:missingPumping:${oid}`,
          message: `Pedido requiere bombeo pero no hay remisión BOMBEO`,
          details: {
            orderId: oid,
            remisionNumbers: agg?.remisionNumbers ?? [],
            drivers: [...new Set(agg?.drivers ?? [])],
            createdBys: [...new Set(agg?.createdBys ?? [])],
            concretoM3: agg?.m3Total ?? 0,
            concretoRemisionCount: agg?.count ?? 0,
          },
        });
      }
    }

    for (const oid of orderIdsForPlant) {
      const evc = evidenceByOrder.get(oid) ?? 0;
      if (evc === 0) {
        const agg = orderAgg.get(oid);
        findings.push({
          rule: 'missingEvidence',
          severity: 'high',
          plantId: p.id,
          plantCode: p.code,
          findingKey: `${p.id}:missingEvidence:${oid}`,
          message: `Pedido sin evidencia de concreto cargada`,
          details: {
            orderId: oid,
            remisionNumbers: agg?.remisionNumbers ?? [],
            drivers: [...new Set(agg?.drivers ?? [])],
            createdBys: [...new Set(agg?.createdBys ?? [])],
            m3Total: agg?.m3Total ?? 0,
            remisionCount: agg?.count ?? 0,
          },
        });
      }
    }

    const mntPlant = mntPlantByCode.get(p.code);
    const dieselL = mntPlant
      ? dieselLitersByMntPlant.get(mntPlant.id) ?? 0
      : 0;

    if (concreto.length > 0 && dieselL <= 0 && mntPlant) {
      findings.push({
        rule: 'noDieselActivity',
        severity: 'info',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:noDiesel`,
        message: `Producción registrada pero sin consumo de diesel`,
        details: { liters: dieselL },
      });
    }

    if (concreto.length === 0 && dieselL > 0 && operating && mntPlant) {
      findings.push({
        rule: 'dieselWithoutProduction',
        severity: 'info',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:dieselNoProd`,
        message: `Consumo de diesel sin remisiones de concreto`,
        details: { liters: dieselL },
      });
    }

    const bombeoRem = plantRem.filter((r) => r.tipo_remision === 'BOMBEO');
    const pumpFailByKey = new Map<
      string,
      {
        closure: Set<string>;
        remisionIds: string[];
        remisionNumbers: string[];
        sampleUnidad: string;
        canonical: string;
      }
    >();

    for (const r of bombeoRem) {
      const rawU = r.unidad?.trim() ?? '';
      if (!rawU || isExternalPumpUnit(rawU)) continue;
      const nk = normUnitKey(rawU);
      if (input.exemptUnits.has(nk)) continue;

      const canon = resolveCanonicalUnitId(rawU, input.unitAliases);
      const pumpAsset = mntPlant
        ? findAssetForPumpUnit(assets, canon, mntPlant.id)
        : findAssetForPumpUnit(assets, canon, undefined);

      if (!pumpAsset) {
        findings.push({
          rule: 'unknownBombeoUnit',
          severity: 'high',
          plantId: p.id,
          plantCode: p.code,
          findingKey: `${p.id}:unknownBombeo:${r.id}`,
          message: `Unidad de bombeo ${rawU} no registrada en mantenimiento`,
          details: {
            unidad: rawU,
            remisionId: r.id,
            remisionNumber: r.remision_number ?? null,
            canonical: canon,
          },
        });
        continue;
      }

      const closure = pumpChecklistClosure(pumpAsset);
      const ok = [...closure].some((id) => checklistAssetIds.has(id));
      if (!ok) {
        const key = [...closure].sort().join('|');
        const ex = pumpFailByKey.get(key);
        if (!ex) {
          pumpFailByKey.set(key, {
            closure,
            remisionIds: [r.id],
            remisionNumbers: r.remision_number ? [r.remision_number] : [],
            sampleUnidad: rawU,
            canonical: canon,
          });
        } else {
          ex.remisionIds.push(r.id);
          if (r.remision_number) ex.remisionNumbers.push(r.remision_number);
        }
      }
    }

    for (const [key, row] of pumpFailByKey) {
      const codes = [...row.closure].map((id) => assetById.get(id)?.asset_id ?? id);
      findings.push({
        rule: 'missingPumpingChecklist',
        severity: 'high',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:missingPumpCc:${key}`,
        message: `Bombeo sin checklist del día (${row.sampleUnidad})`,
        details: {
          unidad: row.sampleUnidad,
          remisionIds: row.remisionIds,
          remisionNumbers: row.remisionNumbers.filter(Boolean),
          canonical: row.canonical,
          assetUuids: [...row.closure],
          assetIds: codes,
        },
      });
    }

    if (mntPlant) {
      const loaders = assets.filter(
        (a) =>
          a.plant_id === mntPlant.id &&
          isLoaderAsset(a) &&
          isOperationalAsset(a),
      );
      if (concreto.length > 0 && loaders.length > 0) {
        const anyLoaderCc = loaders.some((l) => checklistAssetIds.has(l.id));
        if (!anyLoaderCc) {
          findings.push({
            rule: 'missingLoaderChecklist',
            severity: 'high',
            plantId: p.id,
            plantCode: p.code,
            findingKey: `${p.id}:missingLoaderCc`,
            message: `Ningún cargador frontal de la planta registró checklist del día`,
            details: {
              loaderCandidates: loaders.map((l) => ({
                uuid: l.id,
                assetId: l.asset_id,
                name: l.name,
              })),
              concretoRemisionCount: concreto.length,
              producedConcreteM3: m3,
            },
          });
        }
      }

      const pipas = assets.filter(
        (a) =>
          a.plant_id === mntPlant.id &&
          isPipaAsset(a) &&
          isOperationalAsset(a),
      );
      const needsPipaChecklist =
        plantsWithWaterEntry.has(p.id) ||
        (concreto.length > 0 && pipas.length > 0);

      if (needsPipaChecklist) {
        if (pipas.length === 0) {
          if (plantsWithWaterEntry.has(p.id)) {
            findings.push({
              rule: 'waterEntryNoPipaInCatalog',
              severity: 'info',
              plantId: p.id,
              plantCode: p.code,
              findingKey: `${p.id}:waterNoPipa`,
              message: `Entrada de agua registrada pero no hay pipa operativa en catálogo de mantenimiento para esta planta`,
              details: {},
            });
          }
        } else {
          const anyPipaCc = pipas.some((x) => checklistAssetIds.has(x.id));
          if (!anyPipaCc) {
            findings.push({
              rule: 'missingPipaChecklist',
              severity: 'high',
              plantId: p.id,
              plantCode: p.code,
              findingKey: `${p.id}:missingPipaCc`,
              message: `Ninguna pipa elegible de la planta registró checklist del día`,
              details: {
                pipaCandidates: pipas.map((x) => ({
                  uuid: x.id,
                  assetId: x.asset_id,
                  name: x.name,
                })),
                hadWaterEntry: plantsWithWaterEntry.has(p.id),
                concretoRemisionCount: concreto.length,
                producedConcreteM3: m3,
              },
            });
          }
        }
      }
    }
  }

  for (const r of remList.filter((x) => x.tipo_remision === 'CONCRETO')) {
    const p = plantById.get(r.plant_id);
    if (!p) continue;
    const rawU = r.unidad?.trim() ?? '';
    if (!rawU) continue;
    const nk = normUnitKey(rawU);
    if (input.exemptUnits.has(nk)) continue;

    const canon = resolveCanonicalUnitId(rawU, input.unitAliases);
    const asset = findAssetByCanon(canon);

    if (!asset) {
      findings.push({
        rule: 'unknownUnit',
        severity: 'high',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:unknown:${nk}:${r.id}`,
        message: `Unidad ${rawU} no registrada en mantenimiento`,
        details: {
          unidad: rawU,
          remisionId: r.id,
          remisionNumber: r.remision_number ?? null,
          canonical: canon,
          driver: r.conductor ?? null,
          horaCarga: r.hora_carga ?? null,
        },
      });
      continue;
    }

    const hasCc = checklistAssetIds.has(asset.id);
    const mergeKey = `${p.id}:${asset.id}`;
    if (!hasCc) {
      const ex = missingChecklistMerge.get(mergeKey);
      const remisionIds = ex ? [...ex.remisionIds, r.id] : [r.id];
      const remisionNumbers = ex
        ? [...ex.remisionNumbers, r.remision_number ?? '']
        : [r.remision_number ?? ''];
      const drivers = ex
        ? [...ex.drivers, r.conductor ?? '']
        : [r.conductor ?? ''];
      const horaCargas = ex
        ? [...ex.horaCargas, r.hora_carga ?? '']
        : [r.hora_carga ?? ''];
      const createdBys = ex
        ? [...ex.createdBys, r.created_by ?? '']
        : [r.created_by ?? ''];
      const totalM3 =
        (ex?.totalM3 ?? 0) + Number(r.volumen_fabricado ?? 0);
      missingChecklistMerge.set(mergeKey, {
        remisionIds,
        remisionNumbers,
        drivers,
        horaCargas,
        createdBys,
        totalM3,
        sample: r,
        asset,
        plant: p,
      });
    }

    const opName = primaryOperatorByAssetUuid.get(asset.id) ?? '';
    const driver = r.conductor ?? '';
    if (opName && driver && !driverMatchesOperator(driver, opName)) {
      findings.push({
        rule: 'operatorMismatch',
        severity: 'info',
        plantId: p.id,
        plantCode: p.code,
        findingKey: `${p.id}:op:${r.id}`,
        message: `Conductor en remisión no coincide con operador asignado`,
        details: {
          unidad: asset.asset_id,
          driver,
          assignedOperator: opName,
          remisionNumber: r.remision_number,
          horaCarga: r.hora_carga ?? null,
          orderId: r.order_id ?? null,
          createdBy: r.created_by ?? null,
        },
      });
    }
  }

  for (const row of missingChecklistMerge.values()) {
    const homeCode = [...mntPlantByCode.entries()].find(
      ([, v]) => v.id === row.asset.plant_id,
    )?.[0];
    const uniqueDrivers = [...new Set(row.drivers.filter(Boolean))];
    const uniqueCreatedBys = [...new Set(row.createdBys.filter(Boolean))];
    const sortedHoras = row.horaCargas.filter(Boolean).sort();
    findings.push({
      rule: 'missingChecklist',
      severity: 'high',
      plantId: row.plant.id,
      plantCode: row.plant.code,
      findingKey: `${row.plant.id}:missingCc:${row.asset.asset_id}`,
      message: `Unidad ${row.asset.asset_id} cargó concreto sin checklist del día`,
      details: {
        assetId: row.asset.asset_id,
        assetUuid: row.asset.id,
        remisionIds: row.remisionIds,
        remisionNumbers: row.remisionNumbers.filter(Boolean),
        drivers: uniqueDrivers,
        primaryOperator: primaryOperatorByAssetUuid.get(row.asset.id) ?? null,
        horaFirst: sortedHoras[0] ?? null,
        horaLast: sortedHoras[sortedHoras.length - 1] ?? null,
        createdBys: uniqueCreatedBys,
        totalM3: row.totalM3,
        homePlantCode: homeCode ?? null,
      },
    });
  }

  const byPlantCategory: DailyComplianceReport['byPlantCategory'] = {};
  for (const f of findings) {
    if (!byPlantCategory[f.plantId]) byPlantCategory[f.plantId] = {};
    const bucket = byPlantCategory[f.plantId]!;
    if (!bucket[f.rule]) bucket[f.rule] = [];
    bucket[f.rule]!.push(f);
  }

  return {
    targetDate: input.targetDate,
    timezone: TZ,
    plants: summaries,
    findings,
    byPlantCategory,
  };
}
