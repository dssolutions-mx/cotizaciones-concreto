/**
 * P004P Pitahaya — May 2026 cement closure correction
 *
 * - Physical count 38,000 → 40,300 kg
 * - New remanente adjustment 1,700 kg (ENT-20260530-004)
 * - Closure ADJ-20260530-009: 4,913 → 913 kg
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/fix-p004p-may2026-cement-closure-count.ts
 *   npx tsx --env-file=.env.local scripts/fix-p004p-may2026-cement-closure-count.ts --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { computeClosureVarianceFields } from '../src/lib/inventory/closureVariance';
import { consumeFifoForClosureAdjustment } from '../src/lib/inventory/consumeFifoForClosureAdjustment';

const PLANT_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const CLOSURE_ID = '88b390ac-77bf-4cd5-91d1-d606c0d50964';
const MATERIAL_ID = 'c67f3b9a-edfe-4f47-be37-13f983a84df0';
const CLOSURE_MATERIAL_ROW_ID = 'c92604a0-e550-4017-b781-308f3f5b4f9d';
const CLOSURE_ADJ_ID = 'e4d9dcd4-8b28-4ffb-b10c-2a40dc4b35b1';
const MAY30_ENTRY_ID = '803a5234-7630-46c5-a9a2-163f59a08650';
const ADJUSTED_BY = '05f02297-f759-4fc9-b931-48a9aef4aa38';

const ADJ_DATE = '2026-05-30';
const REMANENTE_QTY = 1700;
const CLOSURE_QTY = 913;
const PHYSICAL_KG = 40300;
const THEORETICAL_KG = 41213;
const BOOK_AT_SEAL = 42913;
const BOOK_AFTER_REMANENTE = 41213;
const TARGET_STOCK = 30105;
const VARIANCE_THRESHOLD_PCT = 2;

const dryRun = process.argv.includes('--dry-run');

async function restoreFifoForAdjustment(
  supabase: ReturnType<typeof createClient>,
  adjustmentId: string,
): Promise<void> {
  const { data: allocs } = await supabase
    .from('material_consumption_allocations')
    .select('id, entry_id, quantity_consumed_kg')
    .eq('adjustment_id', adjustmentId);

  if (!allocs?.length) return;

  const entryIds = [...new Set(allocs.map((a) => a.entry_id))];
  const { data: entries } = await supabase
    .from('material_entries')
    .select('id, remaining_quantity_kg')
    .in('id', entryIds);

  const remainingMap = new Map(
    (entries ?? []).map((e) => [e.id, Number(e.remaining_quantity_kg ?? 0)]),
  );

  const restoreMap = new Map<string, number>();
  for (const alloc of allocs) {
    const qty = Number(alloc.quantity_consumed_kg);
    restoreMap.set(alloc.entry_id, (restoreMap.get(alloc.entry_id) ?? 0) + qty);
  }

  const updates = [...restoreMap.entries()].map(([id, qty]) => ({
    id,
    remaining: (remainingMap.get(id) ?? 0) + qty,
  }));

  if (dryRun) {
    console.log('[dry-run] restore FIFO', adjustmentId, updates);
    return;
  }

  const { error: restoreErr } = await supabase.rpc('fn_batch_update_entry_remaining', { updates });
  if (restoreErr) throw new Error(`FIFO restore failed: ${restoreErr.message}`);

  const { error: delErr } = await supabase
    .from('material_consumption_allocations')
    .delete()
    .eq('adjustment_id', adjustmentId);
  if (delErr) throw new Error(`FIFO delete allocations failed: ${delErr.message}`);
}

async function consumeFifoFromEntry(
  supabase: ReturnType<typeof createClient>,
  params: {
    adjustmentId: string;
    entryId: string;
    quantityKg: number;
    consumptionDate: string;
    userId: string;
  },
): Promise<void> {
  const { adjustmentId, entryId, quantityKg, consumptionDate, userId } = params;

  const { data: entry, error: entryErr } = await supabase
    .from('material_entries')
    .select(
      'id, entry_number, entry_date, remaining_quantity_kg, received_qty_kg, quantity_received, unit_price, landed_unit_price, plant_id, material_id',
    )
    .eq('id', entryId)
    .single();

  if (entryErr || !entry) throw new Error(`Entry ${entryId} not found: ${entryErr?.message}`);

  const entryRemaining = Number(entry.remaining_quantity_kg ?? entry.received_qty_kg ?? 0);
  if (entryRemaining + 1e-6 < quantityKg) {
    throw new Error(
      `Entry ${entry.entry_number} has ${entryRemaining} kg remaining, need ${quantityKg} kg`,
    );
  }

  const unitPrice = entry.landed_unit_price
    ? Number(entry.landed_unit_price)
    : Number(entry.unit_price ?? 0);
  const remainingAfter = entryRemaining - quantityKg;
  const totalCost = quantityKg * unitPrice;

  const { data: lot } = await supabase
    .from('material_lots')
    .select('id')
    .eq('entry_id', entryId)
    .maybeSingle();

  if (dryRun) {
    console.log('[dry-run] allocate from entry', entry.entry_number, quantityKg, 'kg');
    return;
  }

  const { error: insErr } = await supabase.from('material_consumption_allocations').insert({
    adjustment_id: adjustmentId,
    remision_id: null,
    remision_material_id: null,
    entry_id: entryId,
    material_id: entry.material_id,
    plant_id: entry.plant_id,
    quantity_consumed_kg: quantityKg,
    unit_price: unitPrice,
    total_cost: totalCost,
    consumption_date: consumptionDate,
    created_by: userId,
    cost_basis: entry.landed_unit_price ? 'landed' : 'material_only',
    lot_id: lot?.id ?? null,
  });
  if (insErr) throw new Error(`FIFO allocation insert failed: ${insErr.message}`);

  const { error: updErr } = await supabase.rpc('fn_batch_update_entry_remaining', {
    updates: [{ id: entryId, remaining: remainingAfter }],
  });
  if (updErr) throw new Error(`FIFO entry remaining update failed: ${updErr.message}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log(dryRun ? '=== DRY RUN ===' : '=== APPLY FIX ===');

  const { data: closure } = await supabase
    .from('inventory_closures')
    .select('status')
    .eq('id', CLOSURE_ID)
    .single();
  if (closure?.status !== 'sealed') throw new Error(`Closure not sealed: ${closure?.status}`);

  const { data: icm } = await supabase
    .from('inventory_closure_materials')
    .select('physical_count_kg, adjustment_id')
    .eq('id', CLOSURE_MATERIAL_ROW_ID)
    .single();
  if (icm?.adjustment_id !== CLOSURE_ADJ_ID) {
    throw new Error(`Unexpected adjustment_id on closure material: ${icm?.adjustment_id}`);
  }

  const { data: inv } = await supabase
    .from('material_inventory')
    .select('current_stock')
    .eq('plant_id', PLANT_ID)
    .eq('material_id', MATERIAL_ID)
    .single();
  const stockBefore = Number(inv?.current_stock ?? 0);
  console.log('current_stock before:', stockBefore);

  const { data: closureAdj } = await supabase
    .from('material_adjustments')
    .select('quantity_adjusted, adjustment_number')
    .eq('id', CLOSURE_ADJ_ID)
    .single();
  if (Number(closureAdj?.quantity_adjusted) !== 4913) {
    throw new Error(`Closure adj qty expected 4913, got ${closureAdj?.quantity_adjusted}`);
  }

  // 1) Restore closure FIFO (4913 kg)
  await restoreFifoForAdjustment(supabase, CLOSURE_ADJ_ID);

  // 2) Insert remanente adjustment (historical book 42913 → 41213)
  const remanenteNumber = 'ADJ-20260530-010';
  const { data: dup } = await supabase
    .from('material_adjustments')
    .select('id')
    .eq('adjustment_number', remanenteNumber)
    .eq('plant_id', PLANT_ID)
    .maybeSingle();
  if (dup) throw new Error(`Adjustment ${remanenteNumber} already exists`);

  let remanenteAdjId: string;
  if (dryRun) {
    remanenteAdjId = '00000000-0000-0000-0000-000000000010';
    console.log('[dry-run] insert remanente', remanenteNumber);
  } else {
    const { data: remAdj, error: remErr } = await supabase
      .from('material_adjustments')
      .insert({
        adjustment_number: remanenteNumber,
        plant_id: PLANT_ID,
        material_id: MATERIAL_ID,
        adjustment_date: ADJ_DATE,
        adjustment_time: '23:50:00',
        adjustment_type: 'correction',
        quantity_adjusted: REMANENTE_QTY,
        inventory_before: BOOK_AT_SEAL,
        inventory_after: BOOK_AFTER_REMANENTE,
        reference_type: 'entry_remanente',
        reference_notes:
          `Remanente 1.7 t en unidad al salir — entrada ENT-20260530-004. ` +
          `Corrección cierre ${CLOSURE_ID} (mayo 2026 P004P).`,
        adjusted_by: ADJUSTED_BY,
      })
      .select('id')
      .single();
    if (remErr || !remAdj) throw new Error(`Remanente adj insert: ${remErr?.message}`);
    remanenteAdjId = remAdj.id;
    console.log('Created remanente adjustment', remanenteNumber, remanenteAdjId);
  }

  await consumeFifoFromEntry(supabase, {
    adjustmentId: remanenteAdjId,
    entryId: MAY30_ENTRY_ID,
    quantityKg: REMANENTE_QTY,
    consumptionDate: ADJ_DATE,
    userId: ADJUSTED_BY,
  });

  // 3) Patch closure adjustment + redo FIFO 913 kg
  if (dryRun) {
    console.log('[dry-run] patch closure adj', CLOSURE_ADJ_ID, 'to', CLOSURE_QTY, 'kg');
  } else {
    const { error: patchErr } = await supabase
      .from('material_adjustments')
      .update({
        quantity_adjusted: CLOSURE_QTY,
        inventory_before: BOOK_AFTER_REMANENTE,
        inventory_after: PHYSICAL_KG,
        updated_at: new Date().toISOString(),
      })
      .eq('id', CLOSURE_ADJ_ID);
    if (patchErr) throw new Error(`Patch closure adj: ${patchErr.message}`);
  }

  if (!dryRun) {
    const cons = await consumeFifoForClosureAdjustment(supabase, {
      adjustmentId: CLOSURE_ADJ_ID,
      adjustmentNumber: closureAdj!.adjustment_number!,
      plantId: PLANT_ID,
      materialId: MATERIAL_ID,
      quantityKg: CLOSURE_QTY,
      consumptionDate: ADJ_DATE,
      userId: ADJUSTED_BY,
      inventoryBefore: BOOK_AFTER_REMANENTE,
      inventoryAfter: PHYSICAL_KG,
    });
    if (!cons.ok) throw new Error(`Closure FIFO consume: ${cons.error}`);
    console.log('Closure FIFO re-allocated, total cost', cons.totalCost);
  } else {
    console.log('[dry-run] consumeFifoForClosureAdjustment', CLOSURE_QTY, 'kg');
  }

  // 4) Closure material snapshot
  const varianceFields = computeClosureVarianceFields(
    PHYSICAL_KG,
    THEORETICAL_KG,
    VARIANCE_THRESHOLD_PCT,
  );

  if (dryRun) {
    console.log('[dry-run] update closure material', { PHYSICAL_KG, THEORETICAL_KG, ...varianceFields });
  } else {
    const { error: icmErr } = await supabase
      .from('inventory_closure_materials')
      .update({
        physical_count_value: PHYSICAL_KG,
        physical_count_kg: PHYSICAL_KG,
        period_adjustments_kg: REMANENTE_QTY,
        theoretical_final_kg: THEORETICAL_KG,
        ...varianceFields,
        updated_at: new Date().toISOString(),
      })
      .eq('id', CLOSURE_MATERIAL_ROW_ID);
    if (icmErr) throw new Error(`Update closure material: ${icmErr.message}`);
  }

  // 5) Live stock → 30105
  if (dryRun) {
    console.log('[dry-run] set current_stock', TARGET_STOCK);
  } else {
    const { error: stockErr } = await supabase
      .from('material_inventory')
      .update({
        current_stock: TARGET_STOCK,
        last_adjustment_date: ADJ_DATE,
        updated_at: new Date().toISOString(),
      })
      .eq('plant_id', PLANT_ID)
      .eq('material_id', MATERIAL_ID);
    if (stockErr) throw new Error(`Update material_inventory: ${stockErr.message}`);
  }

  // 6) Daily log adjustment count
  if (!dryRun) {
    const { data: log } = await supabase
      .from('daily_inventory_log')
      .select('id, total_adjustments')
      .eq('plant_id', PLANT_ID)
      .eq('log_date', ADJ_DATE)
      .maybeSingle();
    if (log) {
      await supabase
        .from('daily_inventory_log')
        .update({
          total_adjustments: Number(log.total_adjustments ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', log.id);
    }
  }

  if (!dryRun) {
    const { data: after } = await supabase
      .from('material_inventory')
      .select('current_stock')
      .eq('plant_id', PLANT_ID)
      .eq('material_id', MATERIAL_ID)
      .single();
    console.log('current_stock after:', after?.current_stock);
    if (Math.abs(Number(after?.current_stock) - TARGET_STOCK) > 0.01) {
      throw new Error(`Stock mismatch: expected ${TARGET_STOCK}, got ${after?.current_stock}`);
    }
  }

  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
