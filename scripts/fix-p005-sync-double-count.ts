/**
 * Undo inventory_sync adjustments (they double-count in fn_reconciled) and set
 * material_inventory.current_stock directly from reconciled arithmetic.
 */
import { createClient } from '@supabase/supabase-js';
import { deleteMaterialAdjustment } from '../src/lib/inventory/deleteMaterialAdjustment';

const P005 = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const SYNC_NUMBERS = [
  'ADJ-20260602-001',
  'ADJ-20260602-002',
  'ADJ-20260602-003',
  'ADJ-20260602-004',
  'ADJ-20260602-005',
  'ADJ-20260602-006',
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing env');
  const supabase = createClient(url, key);

  const { data: adjs } = await supabase
    .from('material_adjustments')
    .select('id, adjustment_number')
    .eq('plant_id', P005)
    .in('adjustment_number', SYNC_NUMBERS);

  for (const adj of adjs ?? []) {
    const r = await deleteMaterialAdjustment(supabase, adj.id);
    if (!r.ok) throw new Error(`${adj.adjustment_number}: ${r.error}`);
    console.log('Deleted', adj.adjustment_number);
  }

  const { data: rows } = await supabase
    .from('v_material_inventory_reconciled')
    .select('material_id, reconciled_stock, materials!inner(material_name)')
    .eq('plant_id', P005)
    .not('reconciled_stock', 'is', null);

  for (const row of rows ?? []) {
    const name = (row.materials as { material_name: string }).material_name;
    const target = Number(row.reconciled_stock);
    const { error } = await supabase
      .from('material_inventory')
      .update({ current_stock: target, updated_at: new Date().toISOString() })
      .eq('plant_id', P005)
      .eq('material_id', row.material_id);
    if (error) throw error;
    console.log(`Stock set ${name} → ${target}`);
  }

  const { data: check } = await supabase
    .from('v_material_inventory_reconciled')
    .select('material_id, delta_vs_reconciled, materials!inner(material_name)')
    .eq('plant_id', P005)
    .not('reconciled_stock', 'is', null);

  const bad = (check ?? []).filter((r) => Math.abs(Number(r.delta_vs_reconciled)) > 0.05);
  if (bad.length) {
    console.error('Still mismatched:', bad);
    process.exit(1);
  }
  console.log('All reconciled materials aligned.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
