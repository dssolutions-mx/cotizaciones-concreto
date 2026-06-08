/**
 * One-off audit: compare dosificador current_stock vs theoretical book for Plant 1.
 *   npx tsx --env-file=.env.local scripts/audit-plant1-stock-alignment.ts
 */
import { createClient } from '@supabase/supabase-js';
import { InventoryDashboardService } from '../src/services/inventoryDashboardService';

const PLANT_P001 = '4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, serviceKey);

  const { data: cut } = await supabase
    .from('plant_cutover_dates')
    .select('cutover_date')
    .eq('plant_id', PLANT_P001)
    .maybeSingle();
  const cutover = (cut?.cutover_date as string) ?? '2026-04-01';
  const today = new Date().toISOString().slice(0, 10);

  const svc = new InventoryDashboardService(supabase);
  const flows = await svc.calculateHistoricalInventory(PLANT_P001, cutover, today);

  const rows = flows
    .map((f) => ({
      code: f.material_code,
      name: f.material_name,
      theoretical: Math.round(Number(f.theoretical_final_stock) * 100) / 100,
      dosificador: Math.round(Number(f.actual_current_stock) * 100) / 100,
      diff: Math.round((Number(f.actual_current_stock) - Number(f.theoretical_final_stock)) * 100) / 100,
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  console.log(`\nPlant P001 alignment  [${cutover} .. ${today}]  (dosificador − theoretical book)\n`);
  console.log('CODE'.padEnd(10), 'THEORETICAL'.padStart(16), 'DOSIFICADOR'.padStart(16), 'DIFF'.padStart(14), '  NAME');
  for (const r of rows) {
    const flag = Math.abs(r.diff) >= 0.5 ? ' <-- MISMATCH' : '';
    console.log(
      String(r.code).padEnd(10),
      r.theoretical.toFixed(2).padStart(16),
      r.dosificador.toFixed(2).padStart(16),
      r.diff.toFixed(2).padStart(14),
      ` ${r.name}${flag}`,
    );
  }
  const mismatches = rows.filter((r) => Math.abs(r.diff) >= 0.5);
  console.log(`\n${mismatches.length} material(s) with |diff| >= 0.5`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
