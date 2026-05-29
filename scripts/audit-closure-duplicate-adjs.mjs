import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
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
}

loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const plantId = '4cc02bc8-990a-4bde-96f2-7a1f5af4d4ad';
const mainClosureId = 'd2f2979e-b6fa-45f2-9b06-2e0742ea72d4';

async function auditClosure(closureId) {
  const { data: closure } = await sb
    .from('inventory_closures')
    .select('id, status, period_start, period_end, signed_at, plant_id')
    .eq('id', closureId)
    .single();

  if (!closure) return null;

  const { data: adjs } = await sb
    .from('material_adjustments')
    .select(
      'id, material_id, adjustment_number, adjustment_date, adjustment_type, quantity_adjusted, inventory_before, inventory_after, reference_notes, created_at, materials(material_name)',
    )
    .eq('plant_id', closure.plant_id)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${closureId}%`)
    .order('created_at');

  const byMaterial = new Map();
  for (const a of adjs ?? []) {
    const list = byMaterial.get(a.material_id) ?? [];
    list.push(a);
    byMaterial.set(a.material_id, list);
  }

  const duplicates = [];
  const singles = [];
  for (const [materialId, list] of byMaterial) {
    const name = list[0].materials?.material_name ?? materialId;
    if (list.length > 1) {
      duplicates.push({ materialId, name, count: list.length, adjustments: list });
    } else if (list.length === 1) {
      singles.push({ name, adj: list[0].adjustment_number, qty: list[0].quantity_adjusted });
    }
  }

  const { data: mats } = await sb
    .from('inventory_closure_materials')
    .select(
      'material_id, variance_kg, adjustment_id, requires_justification, materials(material_name)',
    )
    .eq('closure_id', closureId);

  const varianceNoAdj = (mats ?? []).filter(
    (m) => Math.abs(Number(m.variance_kg ?? 0)) > 0.001 && !m.adjustment_id,
  );
  const linkedNotInNotes = [];
  for (const m of mats ?? []) {
    if (!m.adjustment_id) continue;
    const inNotes = (adjs ?? []).some((a) => a.id === m.adjustment_id);
    if (!inNotes) {
      linkedNotInNotes.push({
        name: m.materials?.material_name,
        adjustment_id: m.adjustment_id,
      });
    }
  }

  return {
    closure,
    totalClosureAdjs: adjs?.length ?? 0,
    materialsWithVariance: (mats ?? []).filter((m) => Math.abs(Number(m.variance_kg ?? 0)) > 0.001)
      .length,
    duplicates,
    singles,
    varianceNoAdj,
    linkedNotInNotes,
    orphanAdjs: (adjs ?? []).filter(
      (a) => !(mats ?? []).some((m) => m.adjustment_id === a.id),
    ),
  };
}

console.log('=== Main closure May León ===\n');
const main = await auditClosure(mainClosureId);
console.log(JSON.stringify(main, null, 2));

if (main) {
  const { data: mats } = await sb
    .from('inventory_closure_materials')
    .select(
      'material_id, theoretical_final_kg, physical_count_kg, variance_kg, adjustment_id, materials(material_name)',
    )
    .eq('closure_id', mainClosureId);
  console.log('\nclosure_materials rows:', JSON.stringify(mats, null, 2));
  const matIds = [...new Set((mats ?? []).map((m) => m.material_id))];
  if (matIds.length) {
    const { data: inv } = await sb
      .from('material_inventory')
      .select('material_id, current_stock, materials(material_name)')
      .eq('plant_id', plantId)
      .in('material_id', matIds);
    console.log('current material_inventory:', JSON.stringify(inv, null, 2));
  }
}

console.log('\n=== Other recent closures (same plant, last 90 days) ===\n');
const { data: closures } = await sb
  .from('inventory_closures')
  .select('id, status, period_start, period_end, signed_at')
  .eq('plant_id', plantId)
  .neq('status', 'cancelled')
  .order('initiated_at', { ascending: false })
  .limit(15);

for (const c of closures ?? []) {
  if (c.id === mainClosureId) continue;
  const r = await auditClosure(c.id);
  if (!r || r.totalClosureAdjs === 0) continue;
  if (r.duplicates.length > 0 || r.varianceNoAdj.length > 0 || r.orphanAdjs.length > 0) {
    console.log(`\n--- ${c.period_start} → ${c.period_end} (${c.status}) ${c.id} ---`);
    console.log(
      JSON.stringify(
        {
          totalClosureAdjs: r.totalClosureAdjs,
          duplicates: r.duplicates.map((d) => ({
            name: d.name,
            count: d.count,
            nums: d.adjustments.map((a) => a.adjustment_number),
          })),
          varianceNoAdj: r.varianceNoAdj,
          orphanAdjs: r.orphanAdjs.map((a) => ({
            name: a.materials?.material_name,
            num: a.adjustment_number,
          })),
        },
        null,
        2,
      ),
    );
  }
}
