import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeRemision, normalizeArkikMaterialKey } from '@/lib/inventory/arkikEntriesComparator';
import type { ArkikConsumoRemisionOnlyExcelRow } from '@/lib/inventory/arkikConsumoRemisionComparator';
import { autoAllocateRemisionFIFO } from '@/services/fifoPricingService';

export type ArkikConsumoSyncStatus =
  | 'ready_insert'
  | 'missing_remision'
  | 'missing_material'
  | 'blocked_existing';

export type ArkikConsumoSyncPreviewRow = ArkikConsumoRemisionOnlyExcelRow & {
  sync_status: ArkikConsumoSyncStatus;
  sync_message: string;
  remision_id: string | null;
  material_id: string | null;
  remision_fecha: string | null;
};

export type ArkikConsumoQtyUpdatePreviewRow = {
  material: string;
  remision: string;
  remision_raw: string;
  cantidad_excel: number;
  unit_arkik: string;
  cantidad_real_db: number;
  diferencia: number;
  remision_id: string;
  remision_material_id: string;
  sync_status: 'ready_update' | 'blocked';
  sync_message: string;
};

export type ArkikConsumoSyncApplyItem =
  | {
      kind: 'insert';
      material_code: string;
      remision: string;
      cantidad: number;
      cantidad_teorica?: number;
    }
  | {
      kind: 'update_qty';
      remision_material_id: string;
      cantidad: number;
    };

export type ArkikConsumoSyncApplyResult = {
  inserted: number;
  updated: number;
  fifo_remision_ids: string[];
  errors: Array<{ item: ArkikConsumoSyncApplyItem; message: string }>;
};

type RemisionRow = { id: string; remision_number: string; fecha: string };

function buildRemisionNormMap(rows: RemisionRow[]): Map<string, RemisionRow> {
  const map = new Map<string, RemisionRow>();
  for (const row of rows) {
    const norm = normalizeRemision(row.remision_number);
    if (norm) map.set(norm, row);
  }
  return map;
}

async function fetchRemisionesInRange(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string
): Promise<RemisionRow[]> {
  const rows: RemisionRow[] = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from('remisiones')
      .select('id, remision_number, fecha')
      .eq('plant_id', plantId)
      .gte('fecha', dateFrom)
      .lte('fecha', dateTo)
      .order('fecha', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as RemisionRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function fetchRemisionesByNumbers(
  supabase: SupabaseClient,
  plantId: string,
  remisionNumbers: string[]
): Promise<RemisionRow[]> {
  if (remisionNumbers.length === 0) return [];
  const found: RemisionRow[] = [];
  const chunkSize = 50;
  for (let i = 0; i < remisionNumbers.length; i += chunkSize) {
    const chunk = remisionNumbers.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('remisiones')
      .select('id, remision_number, fecha')
      .eq('plant_id', plantId)
      .in('remision_number', chunk);
    if (error) throw new Error(error.message);
    found.push(...((data ?? []) as RemisionRow[]));
  }
  return found;
}

async function loadMaterialMap(
  supabase: SupabaseClient,
  plantId: string,
  materialCodes: string[]
): Promise<Map<string, { id: string; material_name: string }>> {
  const codes = [...new Set(materialCodes.map((c) => normalizeArkikMaterialKey(c)).filter(Boolean))];
  const map = new Map<string, { id: string; material_name: string }>();
  if (codes.length === 0) return map;

  const chunkSize = 100;
  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('materials')
      .select('id, material_code, material_name')
      .eq('plant_id', plantId)
      .eq('is_active', true)
      .in('material_code', chunk);
    if (error) throw new Error(error.message);
    for (const m of data ?? []) {
      const code = normalizeArkikMaterialKey(String(m.material_code ?? ''));
      if (code) {
        map.set(code, { id: m.id, material_name: String(m.material_name ?? code) });
      }
    }
  }
  return map;
}

async function loadExistingMaterialKeys(
  supabase: SupabaseClient,
  remisionIds: string[]
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (remisionIds.length === 0) return keys;
  const chunkSize = 100;
  for (let i = 0; i < remisionIds.length; i += chunkSize) {
    const chunk = remisionIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('remision_materiales')
      .select('remision_id, material_id, materials(material_code)')
      .in('remision_id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const mat = row.materials as { material_code?: string } | null;
      const code = normalizeArkikMaterialKey(String(mat?.material_code ?? ''));
      if (code && row.remision_id) {
        keys.add(`${row.remision_id}\0${code}`);
      }
    }
  }
  return keys;
}

export async function previewArkikConsumptionSync(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string,
  onlyExcel: ArkikConsumoRemisionOnlyExcelRow[]
): Promise<ArkikConsumoSyncPreviewRow[]> {
  if (onlyExcel.length === 0) return [];

  let remisionMap = buildRemisionNormMap(
    await fetchRemisionesInRange(supabase, plantId, dateFrom, dateTo)
  );

  const missingNorms = onlyExcel
    .map((r) => r.remision)
    .filter((norm) => norm && !remisionMap.has(norm));

  if (missingNorms.length > 0) {
    const variants = new Set<string>();
    for (const norm of missingNorms) {
      variants.add(norm);
      variants.add(norm.padStart(5, '0'));
      variants.add(norm.padStart(6, '0'));
    }
    const extra = await fetchRemisionesByNumbers(supabase, plantId, [...variants]);
    remisionMap = new Map([...remisionMap, ...buildRemisionNormMap(extra)]);
  }

  const materialMap = await loadMaterialMap(
    supabase,
    plantId,
    onlyExcel.map((r) => r.material)
  );

  const remisionIds = [...new Set([...remisionMap.values()].map((r) => r.id))];
  const existingKeys = await loadExistingMaterialKeys(supabase, remisionIds);

  return onlyExcel.map((row) => {
    const materialKey = normalizeArkikMaterialKey(row.material);
    const remision = remisionMap.get(row.remision);
    const material = materialMap.get(materialKey);

    if (!remision) {
      return {
        ...row,
        sync_status: 'missing_remision',
        sync_message:
          'No hay remisión en el sistema con ese folio. Regístrela en producción/Arkik primero.',
        remision_id: null,
        material_id: null,
        remision_fecha: null,
      };
    }

    if (!material) {
      return {
        ...row,
        sync_status: 'missing_material',
        sync_message: `Material ${row.material} no existe en catálogo de la planta.`,
        remision_id: remision.id,
        material_id: null,
        remision_fecha: remision.fecha,
      };
    }

    const existsKey = `${remision.id}\0${materialKey}`;
    if (existingKeys.has(existsKey)) {
      return {
        ...row,
        sync_status: 'blocked_existing',
        sync_message:
          'Ya existe remision_material para este par (reconciliación desactualizada — vuelva a comparar).',
        remision_id: remision.id,
        material_id: material.id,
        remision_fecha: remision.fecha,
      };
    }

    return {
      ...row,
      sync_status: 'ready_insert',
      sync_message: 'Listo para registrar consumo en remision_materiales.',
      remision_id: remision.id,
      material_id: material.id,
      remision_fecha: remision.fecha,
    };
  });
}

export async function previewArkikConsumptionQtyUpdates(
  supabase: SupabaseClient,
  plantId: string,
  dateFrom: string,
  dateTo: string,
  matchedWithDiff: Array<{
    material: string;
    remision: string;
    remision_raw: string;
    cantidad_excel: number;
    unit_arkik: string;
    cantidad_real_db: number;
    diferencia: number;
  }>
): Promise<ArkikConsumoQtyUpdatePreviewRow[]> {
  if (matchedWithDiff.length === 0) return [];

  const remisionMap = buildRemisionNormMap(
    await fetchRemisionesInRange(supabase, plantId, dateFrom, dateTo)
  );
  const remisionIds = [...new Set([...remisionMap.values()].map((r) => r.id))];

  const rmByKey = new Map<string, { id: string; remision_id: string; cantidad_real: number }>();
  const chunkSize = 100;
  for (let i = 0; i < remisionIds.length; i += chunkSize) {
    const chunk = remisionIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('remision_materiales')
      .select('id, remision_id, cantidad_real, materials(material_code)')
      .in('remision_id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      const mat = row.materials as { material_code?: string } | null;
      const code = normalizeArkikMaterialKey(String(mat?.material_code ?? ''));
      if (!code || !row.remision_id) continue;
      const remision = [...remisionMap.entries()].find(([, r]) => r.id === row.remision_id)?.[0];
      if (!remision) continue;
      rmByKey.set(`${code}\0${remision}`, {
        id: row.id,
        remision_id: row.remision_id,
        cantidad_real: Number(row.cantidad_real) || 0,
      });
    }
  }

  return matchedWithDiff.map((row) => {
    const rm = rmByKey.get(`${normalizeArkikMaterialKey(row.material)}\0${row.remision}`);
    if (!rm) {
      return {
        ...row,
        remision_id: '',
        remision_material_id: '',
        sync_status: 'blocked',
        sync_message: 'No se encontró remision_material para actualizar.',
      };
    }
    return {
      ...row,
      remision_id: rm.remision_id,
      remision_material_id: rm.id,
      sync_status: 'ready_update',
      sync_message: `Actualizar cantidad_real ${row.cantidad_real_db} → ${row.cantidad_excel}`,
    };
  });
}

export async function applyArkikConsumptionSync(
  supabase: SupabaseClient,
  plantId: string,
  userId: string,
  items: ArkikConsumoSyncApplyItem[],
  options?: { runFifo?: boolean }
): Promise<ArkikConsumoSyncApplyResult> {
  const runFifo = options?.runFifo !== false;
  const result: ArkikConsumoSyncApplyResult = {
    inserted: 0,
    updated: 0,
    fifo_remision_ids: [],
    errors: [],
  };
  const fifoRemisionIds = new Set<string>();

  const insertItems = items.filter(
    (i): i is Extract<ArkikConsumoSyncApplyItem, { kind: 'insert' }> => i.kind === 'insert'
  );
  const updateItems = items.filter(
    (i): i is Extract<ArkikConsumoSyncApplyItem, { kind: 'update_qty' }> => i.kind === 'update_qty'
  );

  if (insertItems.length > 0) {
    const materialMap = await loadMaterialMap(
      supabase,
      plantId,
      insertItems.map((i) => i.material_code)
    );

    const variants = new Set<string>();
    for (const item of insertItems) {
      variants.add(item.remision);
      variants.add(item.remision.padStart(5, '0'));
      variants.add(item.remision.padStart(6, '0'));
    }
    const remisionMap = buildRemisionNormMap(
      await fetchRemisionesByNumbers(supabase, plantId, [...variants])
    );

    for (const item of insertItems) {
      const materialKey = normalizeArkikMaterialKey(item.material_code);
      const material = materialMap.get(materialKey);
      const remision = remisionMap.get(item.remision);

      if (!material || !remision) {
        result.errors.push({
          item,
          message: !remision
            ? `Remisión ${item.remision} no encontrada`
            : `Material ${item.material_code} no encontrado`,
        });
        continue;
      }

      const { data: existing } = await supabase
        .from('remision_materiales')
        .select('id')
        .eq('remision_id', remision.id)
        .eq('material_id', material.id)
        .maybeSingle();

      if (existing) {
        result.errors.push({ item, message: 'remision_material ya existe' });
        continue;
      }

      const teorica = item.cantidad_teorica ?? item.cantidad;
      const { error } = await supabase.from('remision_materiales').insert({
        remision_id: remision.id,
        material_id: material.id,
        material_type: material.material_name,
        cantidad_real: item.cantidad,
        cantidad_teorica: teorica,
        ajuste: 0,
      });

      if (error) {
        result.errors.push({ item, message: error.message });
        continue;
      }

      result.inserted += 1;
      fifoRemisionIds.add(remision.id);
    }
  }

  for (const item of updateItems) {
    const { data: rm, error: fetchErr } = await supabase
      .from('remision_materiales')
      .select('id, remision_id, remisiones!inner(plant_id)')
      .eq('id', item.remision_material_id)
      .maybeSingle();

    if (fetchErr || !rm) {
      result.errors.push({ item, message: fetchErr?.message ?? 'remision_material no encontrado' });
      continue;
    }

    const remisionPlant = (rm.remisiones as { plant_id?: string } | null)?.plant_id;
    if (remisionPlant !== plantId) {
      result.errors.push({ item, message: 'Sin acceso a esta remisión' });
      continue;
    }

    const { error } = await supabase
      .from('remision_materiales')
      .update({
        cantidad_real: item.cantidad,
        fifo_allocated_at: null,
        unit_cost_weighted: null,
        total_cost_fifo: null,
      })
      .eq('id', item.remision_material_id);

    if (error) {
      result.errors.push({ item, message: error.message });
      continue;
    }

    result.updated += 1;
    if (rm.remision_id) fifoRemisionIds.add(rm.remision_id);
  }

  if (runFifo) {
    for (const remisionId of fifoRemisionIds) {
      try {
        await autoAllocateRemisionFIFO(remisionId, userId, { supabase });
        result.fifo_remision_ids.push(remisionId);
      } catch (e) {
        result.errors.push({
          item: { kind: 'insert', material_code: '', remision: remisionId, cantidad: 0 },
          message: `FIFO: ${e instanceof Error ? e.message : 'error'}`,
        });
      }
    }
  }

  return result;
}
