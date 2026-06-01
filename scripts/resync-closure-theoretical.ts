/**
 * Re-sync closure theoretical snapshot + variances (physical counts unchanged).
 *
 *   npx tsx --env-file=.env.local scripts/resync-closure-theoretical.ts <closureId>
 */

import { createClient } from '@supabase/supabase-js';
import { InventoryClosureService } from '../src/services/inventoryClosureService';

async function main() {
  const closureId = process.argv[2];
  if (!closureId) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/resync-closure-theoretical.ts <closureId>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);
  const service = new InventoryClosureService(supabase);

  const result = await service.resyncTheoreticalAndVariances(closureId);
  console.log('OK', result);

  const { data: arena } = await supabase
    .from('inventory_closure_materials')
    .select(
      'theoretical_final_kg, physical_count_kg, variance_kg, period_adjustments_kg, materials(material_name)',
    )
    .eq('closure_id', closureId)
    .eq('material_id', '7ddd94ad-8896-4f25-913a-c513b99504e5')
    .maybeSingle();

  if (arena) {
    console.log('Arena Volcánica after resync:', arena);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
