import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertMaterialCostViewAccess } from '@/lib/materialCostTrendAuth';
import {
  MATERIAL_COST_CUTOVER,
  buildMaterialCostSeries,
  defaultReceiptRange,
  effectiveMaterialCategory,
  buildPriceJustification,
  entriesToExceptionRows,
  entriesToReceiptRows,
  entryInDateWindow,
  listPricesToPoints,
  summarizeSeries,
  type MaterialEntryRaw,
  type ReceiptGranularity,
} from '@/lib/materialCostTrend';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }

    const auth = await assertMaterialCostViewAccess(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: materialId } = await params;
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

    const { data: material, error: matErr } = await supabase
      .from('materials')
      .select(
        'id, material_name, category, subcategory, aggregate_type, plant_id, supplier_id, plants(id, name, code), suppliers(id, name)'
      )
      .eq('id', materialId)
      .single();

    if (matErr || !material) {
      return NextResponse.json({ error: 'Material no encontrado' }, { status: 404 });
    }

    const [listRes, entriesRes] = await Promise.all([
      supabase
        .from('material_prices')
        .select('material_id, period_start, price_per_unit')
        .eq('plant_id', plantId)
        .eq('material_id', materialId)
        .lt('period_start', MATERIAL_COST_CUTOVER)
        .order('period_start', { ascending: true }),
      supabase
        .from('material_entries')
        .select(
          'id, material_id, entry_number, entry_date, landed_unit_price, received_qty_kg, quantity_received, excluded_from_fifo, pricing_status'
        )
        .eq('plant_id', plantId)
        .eq('material_id', materialId)
        .gte('entry_date', MATERIAL_COST_CUTOVER)
        .lte('entry_date', to)
        .order('entry_date', { ascending: true }),
    ]);

    if (listRes.error) throw listRes.error;
    if (entriesRes.error) throw entriesRes.error;

    const entries = (entriesRes.data ?? []) as MaterialEntryRaw[];
    const listPoints = listPricesToPoints(
      (listRes.data ?? []).map((r) => ({
        material_id: r.material_id as string,
        period_start: (r.period_start as string) ?? '',
        price_per_unit: Number(r.price_per_unit) || 0,
      }))
    );
    const {
      series,
      actualBuckets,
      monthlySeries,
      monthlyBuckets,
      missingLandedCount,
      pendingReviewCount,
    } = buildMaterialCostSeries(listPoints, entries, granularity, from, to);
    const kpiSeries = monthlySeries;
    const summary = summarizeSeries(kpiSeries);
    const lastActualBucket =
      monthlyBuckets.length > 0 ? monthlyBuckets[monthlyBuckets.length - 1] : null;
    const justification = buildPriceJustification(summary, lastActualBucket);
    const receipts = entriesToReceiptRows(
      entries.filter((e) => entryInDateWindow(e, from, to))
    );
    const exceptions = entriesToExceptionRows(entries, from, to);

    return NextResponse.json({
      material: {
        ...material,
        effective_category: effectiveMaterialCategory(
          material.category,
          material.aggregate_type,
          material.subcategory
        ),
      },
      series,
      monthlySeries,
      monthlyBuckets,
      buckets: actualBuckets,
      listPoints,
      receipts,
      summary,
      justification,
      exceptions,
      missingLandedInPeriod: missingLandedCount,
      pendingReviewInPeriod: pendingReviewCount,
      cutover: MATERIAL_COST_CUTOVER,
      granularity,
      from,
      to,
    });
  } catch (err) {
    console.error('[material-costs/trend]', err);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
