/**
 * Revert P005 (León) May 2026 inventory closure seal — keep physical counts, undo adjustments.
 *
 * 1. Delete all closure-linked material_adjustments (FIFO + stock restored)
 * 2. Unseal closure → reconciled (clear signature; keeps physical counts visible in UI)
 * 3. Resync theoretical snapshot + variances from live ledger
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/revert-p005-may2026-inventory-closure.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/revert-p005-may2026-inventory-closure.ts
 */

import { createClient } from '@supabase/supabase-js';
import { deleteMaterialAdjustment } from '../src/lib/inventory/deleteMaterialAdjustment';
import { InventoryClosureService } from '../src/services/inventoryClosureService';

const P005_PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const CLOSURE_ID = '3f7f4979-9faf-4411-8512-fc46fb18c7aa';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log(dryRun ? '=== DRY RUN ===' : '=== REVERT P005 MAY 2026 CLOSURE ===');

  const { data: closure, error: closureErr } = await supabase
    .from('inventory_closures')
    .select('id, status, plant_id, period_start, period_end')
    .eq('id', CLOSURE_ID)
    .single();

  if (closureErr || !closure) throw new Error(`Closure not found: ${closureErr?.message}`);
  if (closure.plant_id !== P005_PLANT_ID) {
    throw new Error(`Expected plant P005, got ${closure.plant_id}`);
  }
  if (closure.status !== 'sealed') {
    throw new Error(`Closure status is "${closure.status}", expected sealed`);
  }

  console.log('Closure:', closure.period_start, '→', closure.period_end, closure.status);

  const { data: adjs, error: adjErr } = await supabase
    .from('material_adjustments')
    .select('id, adjustment_number, adjustment_type, material_id, quantity_adjusted')
    .eq('plant_id', P005_PLANT_ID)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${CLOSURE_ID}%`)
    .order('adjustment_number', { ascending: true });

  if (adjErr) throw adjErr;
  if (!adjs?.length) throw new Error('No closure adjustments found');

  // Delete corrections before physical_count layers (FIFO consume order).
  const sorted = [...adjs].sort((a, b) => {
    const typeOrder = (t: string) => (t === 'correction' ? 0 : 1);
    const ta = typeOrder(a.adjustment_type);
    const tb = typeOrder(b.adjustment_type);
    if (ta !== tb) return ta - tb;
    return (b.adjustment_number ?? '').localeCompare(a.adjustment_number ?? '');
  });

  console.log(`Found ${sorted.length} closure adjustments to remove:`);
  for (const adj of sorted) {
    console.log(`  ${adj.adjustment_number} ${adj.adjustment_type} ${adj.quantity_adjusted} kg`);
  }

  if (dryRun) {
    console.log('[dry-run] would delete adjustments and unseal closure');
    return;
  }

  for (const adj of sorted) {
    const result = await deleteMaterialAdjustment(supabase, adj.id);
    if (!result.ok) {
      throw new Error(`Failed to delete ${adj.adjustment_number}: ${result.error}`);
    }
    console.log('Deleted', adj.adjustment_number);
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
    .eq('plant_id', P005_PLANT_ID)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${CLOSURE_ID}%`);

  if ((remainingAdjs ?? 0) > 0) {
    throw new Error(`Still ${remainingAdjs} closure adjustments linked to this closure`);
  }

  console.log('\nDone. Next steps in UI:');
  console.log('  1. Production Control → Cierre de inventario → open May 2026 P005');
  console.log('  2. Reconciliación: physical counts are visible; use Recalcular teórico if needed');
  console.log('  3. Stepper → Revisión teórica to inspect bridge; justify if needed → seal');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
