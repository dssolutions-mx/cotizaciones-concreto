/**
 * Re-seal P005 May 2026 inventory closure after ledger corrections (e.g. deleted fake entry).
 *
 * 1. Revert existing seal (delete closure adjustments, unseal, resync theoretical)
 * 2. Restore saved justifications
 * 3. Seal again with prior signature metadata
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/reseal-p005-may2026-inventory-closure.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/reseal-p005-may2026-inventory-closure.ts
 */

import { createClient } from '@supabase/supabase-js';
import { deleteMaterialAdjustment } from '../src/lib/inventory/deleteMaterialAdjustment';
import { InventoryClosureService } from '../src/services/inventoryClosureService';

const P005_PLANT_ID = '8eb389ed-3e6a-4064-b36a-ccfe892c977f';
const CLOSURE_ID = '3f7f4979-9faf-4411-8512-fc46fb18c7aa';

const JUSTIFICATIONS: Array<{ material_name: string; justification_text: string }> = [
  { material_name: 'A28', justification_text: 'VARIANZA EN EL CONTEO' },
  { material_name: 'Aditivo de Línea 510 MX', justification_text: '---' },
  { material_name: 'Agua', justification_text: 'CONSUMOS EN GENERAL DE LA PLANTA' },
  {
    material_name: 'Arena caliza No.4',
    justification_text: 'VARIACION DE INVENTARIO FISICO MAS AJUSTE DE ABRIL',
  },
  { material_name: 'Cemento CPC 40', justification_text: 'FALTA AJUSTE DEL MES DE ABRIL 7.091 T' },
  { material_name: 'Grava Caliza 20 mm', justification_text: 'VARIANZA EN EL CONTEO' },
  { material_name: 'Grava Caliza 40-20 mm MEZCLADA', justification_text: 'MEZCLA EN PATIOS' },
  { material_name: 'Grava Caliza 40mm', justification_text: 'MEZCLA DE GRAVAS 40 MM CON 20 MM' },
  { material_name: 'Hielo', justification_text: 'MERMAS Y USO DE CANTIDADES DIFERENTES DE RECETAS' },
  { material_name: 'IMPERMEABILIZANTE', justification_text: '---' },
  { material_name: 'Inclusor de aire', justification_text: 'VARIANZA EN EL CONTEO' },
  { material_name: 'SR351 (MAPEI)', justification_text: 'AJUSTE DE ABRIL' },
];

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const service = new InventoryClosureService(supabase);

  console.log(dryRun ? '=== DRY RUN ===' : '=== RESEAL P005 MAY 2026 CLOSURE ===');

  const { data: closure, error: closureErr } = await supabase
    .from('inventory_closures')
    .select('id, status, plant_id, period_start, period_end, signed_by, signature_image_url')
    .eq('id', CLOSURE_ID)
    .single();

  if (closureErr || !closure) throw new Error(`Closure not found: ${closureErr?.message}`);
  if (closure.plant_id !== P005_PLANT_ID) {
    throw new Error(`Expected plant P005, got ${closure.plant_id}`);
  }
  if (!closure.signed_by || !closure.signature_image_url) {
    throw new Error('Missing prior signature metadata on closure');
  }

  const sealInput = {
    signed_by: closure.signed_by,
    signature_image_url: closure.signature_image_url,
  };

  console.log('Closure:', closure.period_start, '→', closure.period_end, closure.status);

  const { data: adjs } = await supabase
    .from('material_adjustments')
    .select('id, adjustment_number, adjustment_type, quantity_adjusted, materials(material_name)')
    .eq('plant_id', P005_PLANT_ID)
    .eq('reference_type', 'inventory_closure')
    .ilike('reference_notes', `%${CLOSURE_ID}%`)
    .order('adjustment_number', { ascending: true });

  const sorted = [...(adjs ?? [])].sort((a, b) => {
    const typeOrder = (t: string) => (t === 'correction' ? 0 : 1);
    const ta = typeOrder(a.adjustment_type);
    const tb = typeOrder(b.adjustment_type);
    if (ta !== tb) return ta - tb;
    return (b.adjustment_number ?? '').localeCompare(a.adjustment_number ?? '');
  });

  console.log(`Found ${sorted.length} closure adjustments to remove`);
  for (const adj of sorted) {
    const name = (adj.materials as { material_name?: string } | null)?.material_name ?? '?';
    console.log(`  ${adj.adjustment_number} ${adj.adjustment_type} ${name} ${adj.quantity_adjusted} kg`);
  }

  const { data: gc2Before } = await supabase
    .from('inventory_closure_materials')
    .select('theoretical_final_kg, physical_count_kg, variance_kg, materials(material_name)')
    .eq('closure_id', CLOSURE_ID)
    .eq('material_id', 'fd0b7542-e0fb-4052-ad75-65c09a8ac03b')
    .maybeSingle();

  if (gc2Before) {
    console.log('\nGC2 before resync:', {
      theoretical: gc2Before.theoretical_final_kg,
      physical: gc2Before.physical_count_kg,
      variance: gc2Before.variance_kg,
    });
  }

  if (dryRun) {
    console.log('[dry-run] would revert, resync, restore justifications, and seal');
    return;
  }

  if (closure.status === 'sealed') {
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

    await supabase
      .from('inventory_closure_materials')
      .update({ adjustment_id: null, updated_at: new Date().toISOString() })
      .eq('closure_id', CLOSURE_ID);

    console.log('Closure unsealed → reconciled');
  }

  const resync = await service.resyncTheoreticalAndVariances(CLOSURE_ID);
  console.log('Theoretical resync:', resync);

  const { data: materials } = await supabase
    .from('materials')
    .select('id, material_name')
    .in(
      'material_name',
      JUSTIFICATIONS.map((j) => j.material_name),
    );

  const nameToId = new Map((materials ?? []).map((m) => [m.material_name, m.id]));
  const justificationRows = JUSTIFICATIONS.map((j) => {
    const material_id = nameToId.get(j.material_name);
    if (!material_id) throw new Error(`Material not found: ${j.material_name}`);
    return {
      closure_id: CLOSURE_ID,
      material_id,
      justification_text: j.justification_text,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: justErr } = await supabase
    .from('inventory_closure_materials')
    .upsert(justificationRows, { onConflict: 'closure_id,material_id' });

  if (justErr) throw new Error(`Restore justifications: ${justErr.message}`);

  await supabase
    .from('inventory_closures')
    .update({ status: 'justified', updated_at: new Date().toISOString() })
    .eq('id', CLOSURE_ID);

  console.log('Justifications restored; status → justified');

  const { data: gc2After } = await supabase
    .from('inventory_closure_materials')
    .select('theoretical_final_kg, physical_count_kg, variance_kg')
    .eq('closure_id', CLOSURE_ID)
    .eq('material_id', 'fd0b7542-e0fb-4052-ad75-65c09a8ac03b')
    .maybeSingle();

  console.log('GC2 after resync:', gc2After);

  const sealed = await service.sealClosure(CLOSURE_ID, sealInput.signed_by, sealInput);
  console.log('Sealed closure:', sealed.status, sealed.signed_at);

  const { data: gc2Adj } = await supabase
    .from('material_adjustments')
    .select('adjustment_number, quantity_adjusted, adjustment_type')
    .eq('id', (
      await supabase
        .from('inventory_closure_materials')
        .select('adjustment_id')
        .eq('closure_id', CLOSURE_ID)
        .eq('material_id', 'fd0b7542-e0fb-4052-ad75-65c09a8ac03b')
        .single()
    ).data?.adjustment_id ?? '');

  console.log('GC2 new closure adjustment:', gc2Adj);
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
