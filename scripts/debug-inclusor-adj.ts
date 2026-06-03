import { createClient } from '@supabase/supabase-js';

const P005 = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('missing env');
  const supabase = createClient(url, key);

  const { data: mats } = await supabase
    .from('materials')
    .select('id, material_name, material_code')
    .eq('plant_id', P005)
    .ilike('material_name', '%inclusor%');

  console.log('Materials:', mats);

  for (const m of mats ?? []) {
    const { data: adjs } = await supabase
      .from('material_adjustments')
      .select(
        'adjustment_number, adjustment_type, quantity_adjusted, adjustment_date, created_at, reference_type, reference_notes',
      )
      .eq('plant_id', P005)
      .eq('material_id', m.id)
      .order('adjustment_date', { ascending: true });

    console.log(`\n=== ${m.material_name} (${m.material_code}) all adjustments ===`);
    for (const a of adjs ?? []) {
      const d = String(a.adjustment_date).slice(0, 10);
      const c = String(a.created_at ?? '').slice(0, 10);
      if (d < '2026-04-01' && c < '2026-04-01') continue;
      console.log({
        num: a.adjustment_number,
        type: a.adjustment_type,
        qty: a.quantity_adjusted,
        adjustment_date: d,
        created_at: c,
        ref: a.reference_type,
      });
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
