import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

export type HrWaterEntriesByPlant = {
  plant_id: string;
  code: string;
  name: string;
  totalEntries: number;
  dayMatrix: Record<string, number>;
};

type FetchWaterEntryCountsParams = {
  startDate: string;
  endDate: string;
  plantIds?: string[];
};

/**
 * Count material_entries for water materials (category agua) per plant and day.
 * Mirrors compliance-core water detection; used by RH weekly report.
 */
export async function fetchWaterEntryCountsByPlantDay(
  service: SupabaseClient,
  { startDate, endDate, plantIds }: FetchWaterEntryCountsParams,
): Promise<HrWaterEntriesByPlant[]> {
  const { data: waterMaterials, error: wmErr } = await service
    .from('materials')
    .select('id')
    .ilike('category', 'agua');
  if (wmErr) throw wmErr;

  const waterMaterialIds = [...new Set((waterMaterials ?? []).map((r: { id: string }) => r.id))];
  if (waterMaterialIds.length === 0) return [];

  const dayMatrixByPlant = new Map<string, Map<string, number>>();
  const totalByPlant = new Map<string, number>();
  let offset = 0;

  for (;;) {
    let q = service
      .from('material_entries')
      .select('plant_id, entry_date')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .in('material_id', waterMaterialIds)
      .order('entry_date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (plantIds && plantIds.length > 0) {
      q = q.in('plant_id', plantIds);
    }

    const { data, error } = await q;
    if (error) throw error;

    const batch = data ?? [];
    for (const row of batch) {
      const plantId = (row as { plant_id: string }).plant_id;
      const entryDate = String((row as { entry_date: string }).entry_date ?? '').slice(0, 10);
      if (!plantId || !entryDate) continue;

      totalByPlant.set(plantId, (totalByPlant.get(plantId) ?? 0) + 1);
      const dm = dayMatrixByPlant.get(plantId) ?? new Map<string, number>();
      dm.set(entryDate, (dm.get(entryDate) ?? 0) + 1);
      dayMatrixByPlant.set(plantId, dm);
    }

    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const plantIdsSeen = [...totalByPlant.keys()];
  if (plantIdsSeen.length === 0) return [];

  const { data: plantRows, error: plantErr } = await service
    .from('plants')
    .select('id, code, name')
    .in('id', plantIdsSeen);
  if (plantErr) throw plantErr;

  const plantLabel = new Map<string, { code: string; name: string }>();
  for (const p of plantRows ?? []) {
    const row = p as { id: string; code: string | null; name: string | null };
    plantLabel.set(row.id, {
      code: row.code ?? '—',
      name: row.name ?? '—',
    });
  }

  return plantIdsSeen
    .map((plant_id) => {
      const label = plantLabel.get(plant_id);
      const dm = dayMatrixByPlant.get(plant_id) ?? new Map<string, number>();
      return {
        plant_id,
        code: label?.code ?? '—',
        name: label?.name ?? '—',
        totalEntries: totalByPlant.get(plant_id) ?? 0,
        dayMatrix: Object.fromEntries(dm),
      };
    })
    .sort((a, b) => b.totalEntries - a.totalEntries || a.name.localeCompare(b.name, 'es'));
}
