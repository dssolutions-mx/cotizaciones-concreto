import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const p = resolve(process.cwd(), '.env.local');
for (const line of readFileSync(p, 'utf8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  process.env[t.slice(0, i)] = v;
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const plant = '4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad';

const bad = await sb
  .from('material_adjustments')
  .select('id, materials:material_id(material_name, unit)')
  .eq('plant_id', plant)
  .limit(1);
console.log('BAD unit:', bad.error?.message ?? `ok n=${bad.data?.length}`);

const good = await sb
  .from('material_adjustments')
  .select(
    'id, adjustment_number, materials:material_id(material_name, unit_of_measure), adjusted_by_user:user_profiles!material_adjustments_adjusted_by_fkey(first_name)',
  )
  .eq('plant_id', plant)
  .gte('adjustment_date', '2026-05-01')
  .lte('adjustment_date', '2026-05-29')
  .limit(5);
console.log('GOOD:', good.error?.message ?? `ok n=${good.data?.length}`);
if (good.data?.[0]) console.log(JSON.stringify(good.data[0], null, 2));
