import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertMaterialCostViewAccess } from '@/lib/materialCostTrendAuth';
import {
  MATERIAL_COST_CUTOVER,
  buildMaterialCostSeries,
  defaultReceiptRange,
  effectiveMaterialCategory,
  groupEntriesByMaterial,
  groupListPricesByMaterial,
  isEligibleReceiptForCost,
  entryInDateWindow,
  listPricesToPoints,
  sparklineFromSeries,
  summarizeSeries,
  type MaterialEntryRaw,
  type ReceiptGranularity,
} from '@/lib/materialCostTrend';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    const auth = await assertMaterialCostViewAccess(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const plantId = searchParams.get('plant_id');
    const grainParam = searchParams.get('granularity');
    const granularity: ReceiptGranularity =
      grainParam === 'day' ? 'day' : grainParam === 'week' ? 'week' : 'month';

    const defaultRange = defaultReceiptRange();
    const from = searchParams.get('from') ?? defaultRange.from;
    const to = searchParams.get('to') ?? defaultRange.to;

    if (!plantId) {
      return NextResponse.json(
        { error: 'plant_id es requerido' },
        { status: 400 }
      );
    }

    const { data: materials, error: matErr } = await supabase
      .from('materials')
      .select(
        'id, material_name, category, subcategory, aggregate_type, plant_id, supplier_id, plants(id, name, code), suppliers(id, name)'
      )
      .eq('is_active', true)
      .eq('plant_id', plantId)
      .order('material_name');

    if (matErr) throw matErr;
    if (!materials?.length) {
      return NextResponse.json({
        materials: [],
        cutover: MATERIAL_COST_CUTOVER,
        granularity,
        from,
        to,
      });
    }

    const materialIds = materials.map((m) => m.id);

    const [listRes, entriesRes] = await Promise.all([
      supabase
        .from('material_prices')
        .select('material_id, period_start, price_per_unit')
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .lt('period_start', MATERIAL_COST_CUTOVER)
        .order('period_start', { ascending: true }),
      supabase
        .from('material_entries')
        .select(
          'id, material_id, entry_number, entry_date, landed_unit_price, received_qty_kg, quantity_received, excluded_from_fifo, pricing_status'
        )
        .eq('plant_id', plantId)
        .in('material_id', materialIds)
        .gte('entry_date', MATERIAL_COST_CUTOVER)
        .lte('entry_date', to)
        .order('entry_date', { ascending: true }),
    ]);

    if (listRes.error) throw listRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const listByMaterial = groupListPricesByMaterial(
      (listRes.data ?? []).map((r) => ({
        material_id: r.material_id as string,
        period_start: (r.period_start as string) ?? '',
        price_per_unit: Number(r.price_per_unit) || 0,
      }))
    );
    const entriesByMaterial = groupEntriesByMaterial(
      (entriesRes.data ?? []) as MaterialEntryRaw[]
    );

    const summaries = materials.map((mat) => {
      const listPoints = listPricesToPoints(listByMaterial.get(mat.id) ?? []);
      const matEntries = entriesByMaterial.get(mat.id) ?? [];
      const {
        monthlySeries,
        missingLandedCount,
        pendingReviewCount,
      } = buildMaterialCostSeries(listPoints, matEntries, granularity, from, to);
      const summary = summarizeSeries(monthlySeries);
      const receiptsInPeriod = matEntries.filter(
        (e) => entryInDateWindow(e, from, to) && isEligibleReceiptForCost(e)
      ).length;

      return {
        id: mat.id,
        material_name: mat.material_name,
        category: mat.category,
        effective_category: effectiveMaterialCategory(
          mat.category,
          mat.aggregate_type,
          mat.subcategory
        ),
        subcategory: mat.subcategory,
        plant_id: mat.plant_id,
        plants: mat.plants,
        suppliers: mat.suppliers,
        sparkline: sparklineFromSeries(monthlySeries),
        ...summary,
        receiptCountInPeriod: receiptsInPeriod,
        missingLandedInPeriod: missingLandedCount,
        pendingReviewInPeriod: pendingReviewCount,
      };
    });

    summaries.sort((a, b) => {
      if (a.hasAlert && !b.hasAlert) return -1;
      if (!a.hasAlert && b.hasAlert) return 1;
      return a.material_name.localeCompare(b.material_name, 'es');
    });

    return NextResponse.json({
      materials: summaries,
      cutover: MATERIAL_COST_CUTOVER,
      granularity,
      from,
      to,
    });
  } catch (err) {
    console.error('[material-costs/summary]', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
