/**
 * Revert P004P (Pitahaya) May 2026 inventory closure seal — keep physical counts, undo adjustments.
 *
 * 1. Delete all closure-linked material_adjustments (FIFO + stock restored)
 * 2. Unseal closure → reconciled (clear signature; keeps physical counts visible in UI)
 * 3. Resync theoretical snapshot + variances from live ledger
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/revert-p004p-may2026-inventory-closure.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/revert-p004p-may2026-inventory-closure.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deleteMaterialAdjustment } from '../src/lib/inventory/deleteMaterialAdjustment';
import { InventoryClosureService } from '../src/services/inventoryClosureService';
import { autoAllocateRemisionFIFO } from '../src/services/fifoPricingService';

const P004P_PLANT_ID = 'af86c90f-c76f-44fb-9e2d-d5460ae51aca';
const CLOSURE_ID = '88b390ac-77bf-4cd5-91d1-d606c0d50964';
const ADJP_NOTES_MARKER = 'adj_fifo_free_layer_from_adjustment:';
const FALLBACK_USER_ID = '05f02297-f759-4fc9-b931-48a9aef4aa38';

const dryRun = process.argv.includes('--dry-run');

/** physical_count closure layers may be consumed by June remisiones — clear those first, then delete. */
async function deleteClosureAdjustment(
  supabase: SupabaseClient,
  adjustmentId: string,
  userId: string,
): Promise<void> {
  const { data: synthEntries } = await supabase
    .from('material_entries')
    .select('id')
    .ilike('notes', `%${ADJP_NOTES_MARKER}${adjustmentId}%`);

  const remisionIds = new Set<string>();

  for (const entry of synthEntries ?? []) {
    const { data: entryAllocs } = await supabase
      .from('material_consumption_allocations')
      .select('id, remision_id')
      .eq('entry_id', entry.id);

    for (const alloc of entryAllocs ?? []) {
      if (alloc.remision_id) remisionIds.add(alloc.remision_id);
    }

    if (entryAllocs?.length) {
      const { error: delAllocErr } = await supabase
        .from('material_consumption_allocations')
        .delete()
        .eq('entry_id', entry.id);
      if (delAllocErr) {
        throw new Error(`Delete synth-entry allocations: ${delAllocErr.message}`);
      }
    }

    const { error: entryDelErr } = await supabase.from('material_entries').delete().eq('id', entry.id);
    if (entryDelErr) {
      throw new Error(`Delete synth entry ${entry.id}: ${entryDelErr.message}`);
    }
  }

  const result = await deleteMaterialAdjustment(supabase, adjustmentId);
  if (!result.ok) {
    throw new Error(result.error);
  }

  for (const remisionId of remisionIds) {
    const fifo = await autoAllocateRemisionFIFO(remisionId, userId, { supabase });
    if (!fifo.success && fifo.errors.length > 0) {
      console.warn(`FIFO re-alloc ${remisionId}:`, fifo.errors);
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log(dryRun ? '=== DRY RUN ===' : '=== REVERT P004P MAY 2026 CLOSURE ===');

  const { data: closure, error: closureErr } = await supabase
    .from('inventory_closures')
    .select('id, status, plant_id, period_start, period_end, signed_by')
    .eq('id', CLOSURE_ID)
    .single();

  if (closureErr || !closure) throw new Error(`Closure not found: ${closureErr?.message}`);
  if (closure.plant_id !== P004P_PLANT_ID) {
    throw new Error(`Expected plant P004P, got ${closure.plant_id}`);
  }
  const userId = closure.signed_by ?? FALLBACK_USER_ID;
  if (!['sealed', 'reconciled'].includes(closure.status)) {
    throw new Error(`Unexpected closure status "${closure.status}"`);
  }

  console.log('Closure:', closure.period_start, '→', closure.period_end, closure.status);

  const { data: adjs, error: adjErr } = await supabase
    .from('material_adjustments')
    .select('id, adjustment_number, adjustment_type, material_id, quantity_adjusted')
    .eq('plant_id', P004P_PLANT_ID)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${CLOSURE_ID}%`)
    .order('adjustment_number', { ascending: true });

  if (adjErr) throw adjErr;

  const sorted = [...(adjs ?? [])].sort((a, b) => {
    const typeOrder = (t: string) => (t === 'correction' ? 0 : 1);
    const ta = typeOrder(a.adjustment_type);
    const tb = typeOrder(b.adjustment_type);
    if (ta !== tb) return ta - tb;
    return (a.adjustment_number ?? '').localeCompare(b.adjustment_number ?? '');
  });

  console.log(`Found ${sorted.length} closure adjustments to remove:`);
  for (const adj of sorted) {
    console.log(`  ${adj.adjustment_number} ${adj.adjustment_type} ${adj.quantity_adjusted} kg`);
  }

  if (!sorted.length) {
    console.warn('No closure adjustments found — will still unseal and resync');
  }

  for (const adj of sorted) {
    if (dryRun) continue;
    await deleteClosureAdjustment(supabase, adj.id, userId);
    console.log('Deleted', adj.adjustment_number);
  }

  if (dryRun) {
    console.log('[dry-run] would delete adjustments and unseal closure');
    return;
  }

  const { error: unsealErr } = await supabase
    .from('inventory_closures')
    .update({
      status: 'reconciled',
      signed_by: null,
      signed_at: null,
      signature_image_url: null,
      excel_export_path: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', CLOSURE_ID);

  if (unsealErr) throw new Error(`Unseal closure: ${unsealErr.message}`);
  console.log('Closure unsealed → reconciled');

  const { error: clearJustErr } = await supabase
    .from('inventory_closure_materials')
    .update({
      justification_text: null,
      adjustment_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('closure_id', CLOSURE_ID);

  if (clearJustErr) throw new Error(`Clear closure materials: ${clearJustErr.message}`);

  const service = new InventoryClosureService(supabase);
  const resync = await service.resyncTheoreticalAndVariances(CLOSURE_ID);
  console.log('Theoretical resync:', resync);

  const { data: sample } = await supabase
    .from('inventory_closure_materials')
    .select(
      'physical_count_kg, theoretical_final_kg, variance_kg, variance_pct, requires_justification, materials(material_name)',
    )
    .eq('closure_id', CLOSURE_ID)
    .not('physical_count_kg', 'is', null)
    .order('variance_pct', { ascending: false })
    .limit(8);

  console.log('\nSample materials after resync (highest |variance%|):');
  for (const row of sample ?? []) {
    const name = (row.materials as { material_name?: string } | null)?.material_name ?? '?';
    console.log(
      `  ${name}: phys=${row.physical_count_kg} theor=${row.theoretical_final_kg} var=${row.variance_kg} (${row.variance_pct?.toFixed?.(1)}%) justify=${row.requires_justification}`,
    );
  }

  const { count: remainingAdjs } = await supabase
    .from('material_adjustments')
    .select('id', { count: 'exact', head: true })
    .eq('plant_id', P004P_PLANT_ID)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${CLOSURE_ID}%`);

  if ((remainingAdjs ?? 0) > 0) {
    throw new Error(`Still ${remainingAdjs} closure adjustments linked to this closure`);
  }

  console.log('\nDone. Next steps in UI:');
  console.log('  1. Production Control → Cierre de inventario → open May 2026 P004P');
  console.log('  2. Reconciliación: physical counts preserved; use Recalcular teórico if needed');
  console.log('  3. Revisión teórica → justify if needed → seal again');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
