import assert from 'node:assert';
import {
  compareArkikConsumosConRemision,
  normalizeArkikConsumoRemision,
} from '@/lib/inventory/arkikConsumoRemisionComparator';

assert.strictEqual(normalizeArkikConsumoRemision('P001-027472'), '27472');
assert.strictEqual(normalizeArkikConsumoRemision('027472'), '27472');
assert.strictEqual(normalizeArkikConsumoRemision(''), null);

const matched = compareArkikConsumosConRemision(
  [
    {
      material: 'CEM001',
      proveedor: 'P',
      movement_type: 'Consumo',
      remision: 'P001-027472',
      notas: 'OK',
      cantidad: 500,
      unit_arkik: 'kg',
      cantidad_kg: 500,
      fecha: '2026-05-15',
    },
  ],
  [
    {
      remision_number: '27472',
      fecha: '2026-05-15',
      material_id: 'm1',
      material_code: 'CEM001',
      cantidad_real: 500,
      cantidad_teorica: 480,
    },
  ]
);

assert.strictEqual(matched.matched.length, 1);
assert.strictEqual(matched.matched[0].tiene_diferencia, false);
assert.strictEqual(matched.only_excel.length, 0);
assert.strictEqual(matched.only_db.length, 0);

const qtyDiff = compareArkikConsumosConRemision(
  [
    {
      material: 'CEM001',
      proveedor: 'P',
      movement_type: 'Consumo',
      remision: '27472',
      notas: '',
      cantidad: 510,
      unit_arkik: 'kg',
      cantidad_kg: 510,
      fecha: '2026-05-15',
    },
  ],
  [
    {
      remision_number: '27472',
      fecha: '2026-05-15',
      material_id: 'm1',
      material_code: 'CEM001',
      cantidad_real: 500,
      cantidad_teorica: 480,
    },
  ]
);

assert.strictEqual(qtyDiff.matched.length, 1);
assert.strictEqual(qtyDiff.matched[0].tiene_diferencia, true);
assert.strictEqual(qtyDiff.matched[0].diferencia, 10);
assert.strictEqual(qtyDiff.meta.matched_with_qty_diff, 1);

const onlyExcel = compareArkikConsumosConRemision(
  [
    {
      material: 'ARE001',
      proveedor: 'P',
      movement_type: 'Consumo',
      remision: '99999',
      notas: 'missing',
      cantidad: 100,
      unit_arkik: 'kg',
      cantidad_kg: 100,
      fecha: '2026-05-15',
    },
  ],
  []
);

assert.strictEqual(onlyExcel.only_excel.length, 1);
assert.strictEqual(onlyExcel.only_db.length, 0);

console.log('arkikConsumoRemisionComparator.test.ts: ok');
