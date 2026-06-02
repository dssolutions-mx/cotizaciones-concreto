/**
 * Align P005 material_inventory (dosificador) with fn_reconciled_stock_since_cutover.
 *
 * Uses a direct stock UPDATE (not adjustment rows) so fn_reconciled is not double-counted.
 * Skips materials without P005 opening baseline (no *_opening initial_count).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/sync-p005-dosificador-to-reconciled.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/sync-p005-dosificador-to-reconciled.ts --apply
 */

import { createClient } from '@supabase/supabase-js';
import { InventoryClosureService } from '../src/services/inventoryClosureService';

const P005_PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const MAY_CLOSURE_ID = '3f7f4979-9faf-4411-8512-fc46fb18c7aa';
const QTY_EPS = 0.05;

const dryRun = !process.argv.includes('--apply');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  console.log(dryRun ? '=== DRY RUN ===' : '=== APPLY P005 DOSIFICADOR SYNC ===');

  const { data: rows, error: listErr } = await supabase
    .from('v_material_inventory_reconciled')
    .select(
      'material_id, dosificador_stock, reconciled_stock, materials!inner(material_name, is_active)',
    )
    .eq('plant_id', P005_PLANT_ID)
    .eq('materials.is_active', true);

  if (listErr) throw listErr;

  const plan: Array<{ material_id: string; name: string; live: number; target: number; delta: number }> =
    [];

  for (const row of rows ?? []) {
    const name = (row.materials as { material_name: string }).material_name;
    const live = Number(row.dosificador_stock ?? 0);
    if (row.reconciled_stock == null) {
      console.log(`SKIP (no opening baseline): ${name}`);
      continue;
    }
    const target = Number(row.reconciled_stock);
    const delta = target - live;
    if (Math.abs(delta) < QTY_EPS) {
      console.log(`OK: ${name} (${live.toFixed(2)} kg)`);
      continue;
    }
    plan.push({ material_id: row.material_id, name, live, target, delta });
    console.log(
      `SET: ${name} ${live.toFixed(2)} → ${target.toFixed(2)} (${delta > 0 ? '+' : ''}${delta.toFixed(2)})`,
    );
  }

  console.log(`\n${plan.length} material(s) to align`);

  if (dryRun) return;

  for (const item of plan) {
    const { error } = await supabase
      .from('material_inventory')
      .update({ current_stock: item.target, updated_at: new Date().toISOString() })
      .eq('plant_id', P005_PLANT_ID)
      .eq('material_id', item.material_id);
    if (error) throw new Error(`${item.name}: ${error.message}`);
    console.log(`Updated ${item.name} → ${item.target.toFixed(2)} kg`);
  }

  const service = new InventoryClosureService(supabase);
  const resync = await service.resyncTheoreticalAndVariances(MAY_CLOSURE_ID);
  console.log('May closure theoretical resync:', resync);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
